import {
  BadRequestException,
  Controller,
  Headers,
  InternalServerErrorException,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import Stripe from 'stripe';
import { Public } from '../auth/decorators/public.decorator';
import { StripeService } from './stripe.service';
import { User } from '../users/entities/user.entity';
import { Service } from '../services/entities/service.entity';

// ─── Helpers de módulo ────────────────────────────────────────────────────────

/** Mapeo de Stripe Price IDs → subscription_status local */
function priceIdToStatus(priceId: string): 'starter' | 'active' | null {
  if (priceId === process.env.STRIPE_PRICE_BASIC) return 'starter';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'active';
  return null;
}

/** Convierte el campo current_period_end de Stripe (Unix timestamp) a Date */
function periodEnd(sub: Stripe.Subscription): Date {
  return new Date(sub.current_period_end * 1000);
}

/**
 * Determina si un error es transitorio (infraestructura caída) o permanente
 * (error de negocio como usuario no encontrado).
 *
 * Parche #1: solo los errores transitorios deben causar un 500 para que
 * Stripe reintente. Los errores de negocio deben retornar 200.
 */
function isTransientError(err: any): boolean {
  // Códigos de error de red y PostgreSQL de conexión caída
  const transientCodes = [
    'ECONNREFUSED',   // PostgreSQL no responde
    'ETIMEDOUT',      // Timeout de conexión
    'ENOTFOUND',      // DNS no resuelve
    '57P01',          // PostgreSQL: admin shutdown
    '08006',          // PostgreSQL: connection failure
    '08001',          // PostgreSQL: unable to connect
    '08004',          // PostgreSQL: rejected connection
    'PROTOCOL_CONNECTION_LOST', // MySQL (por si acaso)
  ];
  return transientCodes.some(
    (code) => err.code === code || err.message?.includes(code),
  );
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiExcludeController()
@Public()
@SkipThrottle()   // Parche #5: el ThrottlerGuard global causaría 429s en ráfagas de Stripe
@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
  ) {}

  /**
   * POST /stripe/webhook
   *
   * Parches aplicados:
   *   #1 — Errores transitorios (BD caída) → 500 → Stripe reintenta.
   *         Errores de negocio (usuario no existe) → 200 → no reintentar.
   *   #2 — Verifica el status en Stripe antes de reactivar suscripciones canceladas.
   *   #5 — @SkipThrottle() evita 429s en ráfagas de eventos.
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Falta el header stripe-signature');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Raw body no disponible. Asegúrate de habilitar rawBody: true en NestFactory.create()',
      );
    }

    // Verificación HMAC: imposible de falsificar sin STRIPE_WEBHOOK_SECRET
    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (err: any) {
      this.logger.warn(`Webhook firma inválida: ${err.message}`);
      throw new BadRequestException(`Webhook inválido: ${err.message}`);
    }

    this.logger.log(`Evento recibido: ${event.type} [${event.id}]`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'invoice.payment_succeeded':
          await this.onPaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.onPaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.updated':
          await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        default:
          this.logger.debug(`Evento no manejado: ${event.type}`);
      }
    } catch (err: any) {
      // Parche #1: diferenciar errores transitorios de errores de negocio.
      //
      // ERROR TRANSITORIO (BD caída, red, timeout):
      //   → lanzar excepción → NestJS responde 500 → Stripe reintenta con backoff
      //
      // ERROR DE NEGOCIO (usuario no existe, priceId desconocido):
      //   → solo loguear → retornar 200 → Stripe no reintenta (no tiene sentido)
      if (isTransientError(err)) {
        this.logger.error(
          `Error transitorio procesando ${event.type} [${event.id}], Stripe reintentará: ${err.message}`,
          err.stack,
        );
        throw new InternalServerErrorException('Error de infraestructura temporal. Stripe reintentará el evento.');
      }

      this.logger.error(
        `Error de negocio procesando ${event.type} [${event.id}]: ${err.message}`,
        err.stack,
      );
      // Retornar 200 implícito — Stripe no necesita reintentar errores de negocio
    }

    return { received: true };
  }

  // ─── Handlers privados ────────────────────────────────────────────────────

  /**
   * checkout.session.completed
   * El usuario completó el pago inicial. Activamos el plan.
   */
  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.warn('checkout.session.completed sin userId en metadata — ignorado');
      return;
    }

    if (session.mode !== 'subscription' || !session.subscription) {
      return;
    }

    const sub = await this.stripeService.retrieveSubscription(
      session.subscription as string,
    );

    const priceId = sub.items.data[0]?.price.id;
    const newStatus = priceIdToStatus(priceId);

    if (!newStatus) {
      this.logger.warn(
        `checkout.session.completed: price ID desconocido "${priceId}" para userId ${userId}`,
      );
      return;
    }

    await this.userRepo.update(userId, {
      subscription_status: newStatus,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer as string,
      stripe_price_id: priceId,
      current_period_end: periodEnd(sub),
      past_due_since: null,
    });

    this.logger.log(`Plan activado: userId=${userId} → ${newStatus}`);
  }

  /**
   * invoice.payment_succeeded
   * Pago mensual exitoso. Actualizamos current_period_end.
   *
   * Parche #2: antes de reactivar, verificamos que la suscripción en Stripe
   * siga activa. Esto previene que un evento stale reactiva una suscripción
   * que ya fue cancelada localmente.
   */
  private async onPaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    // El pago inicial (billing_reason='subscription_create') ya lo procesa
    // checkout.session.completed. Evitamos doble procesamiento.
    if (!customerId || invoice.billing_reason === 'subscription_create') {
      return;
    }

    const user = await this.userRepo.findOne({
      where: { stripe_customer_id: customerId },
    });
    if (!user) {
      this.logger.warn(`invoice.payment_succeeded: customer ${customerId} no encontrado`);
      return;
    }

    const sub = await this.stripeService.retrieveSubscription(
      invoice.subscription as string,
    );

    // Parche #2: verificar estado en Stripe antes de actualizar.
    // Si la suscripción en Stripe NO está activa (fue cancelada, expiró, etc.),
    // ignoramos el evento aunque haya sido un pago exitoso (puede ser un evento
    // retrasado o reintentado de un ciclo anterior).
    if (sub.status !== 'active' && sub.status !== 'trialing') {
      this.logger.warn(
        `invoice.payment_succeeded ignorado: suscripción ${sub.id} tiene status "${sub.status}" en Stripe (esperado: active/trialing)`,
      );
      return;
    }

    const priceId = sub.items.data[0]?.price.id;
    const newStatus = priceIdToStatus(priceId) ?? user.subscription_status;

    // Parche #2: solo 'past_due' puede recuperarse aquí.
    // 'cancelled' no se reactiva por un invoice —  requiere un nuevo Checkout.
    // Esto previene que eventos stale conviertan 'cancelled' → 'active'.
    const wasPaymentIssue = user.subscription_status === 'past_due';

    await this.userRepo.update(user.id, {
      subscription_status: wasPaymentIssue ? newStatus : user.subscription_status,
      stripe_price_id: priceId,
      current_period_end: periodEnd(sub),
      past_due_since: null,
    });

    // Si se recuperó de past_due, reactivar servicios que estaban ocultos
    if (wasPaymentIssue) {
      await this.serviceRepo.update({ userId: user.id }, { isVisible: true });
      this.logger.log(`Servicios reactivados para userId=${user.id} (recuperado de past_due)`);
    }

    this.logger.log(
      `Pago renovado: userId=${user.id}, period_end=${periodEnd(sub).toISOString()}`,
    );
  }

  /**
   * invoice.payment_failed
   * El cobro mensual falló. Marcamos past_due y registramos la fecha.
   * El SubscriptionService tiene una gracia de 5 días antes de ocultar servicios.
   */
  private async onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    if (!customerId) return;

    const user = await this.userRepo.findOne({
      where: { stripe_customer_id: customerId },
    });
    if (!user) {
      this.logger.warn(`invoice.payment_failed: customer ${customerId} no encontrado`);
      return;
    }

    const update: Partial<User> = {
      subscription_status: 'past_due',
    };

    // Registrar la fecha del primer fallo para calcular el periodo de gracia de 5 días
    if (!user.past_due_since) {
      update.past_due_since = new Date();
    }

    await this.userRepo.update(user.id, update);
    this.logger.warn(`Pago fallido: userId=${user.id} → past_due`);
  }

  /**
   * customer.subscription.updated
   * El plan cambió (upgrade/downgrade) o el status en Stripe cambió.
   */
  private async onSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const customerId = sub.customer as string;

    const user = await this.userRepo.findOne({
      where: { stripe_customer_id: customerId },
    });
    if (!user) {
      this.logger.warn(
        `customer.subscription.updated: customer ${customerId} no encontrado`,
      );
      return;
    }

    const priceId = sub.items.data[0]?.price.id;
    const newLocalStatus = priceIdToStatus(priceId);

    // Mapeo del status de Stripe al status local
    let resolvedStatus = user.subscription_status;

    if (sub.status === 'active' || sub.status === 'trialing') {
      resolvedStatus = newLocalStatus ?? user.subscription_status;
    } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
      resolvedStatus = 'past_due';
    } else if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
      resolvedStatus = 'cancelled';
    }

    await this.userRepo.update(user.id, {
      subscription_status: resolvedStatus,
      stripe_price_id: priceId ?? user.stripe_price_id,
      current_period_end: periodEnd(sub),
      past_due_since:
        resolvedStatus === 'past_due' && !user.past_due_since
          ? new Date()
          : resolvedStatus !== 'past_due'
            ? null
            : user.past_due_since,
    });

    this.logger.log(
      `Suscripción actualizada: userId=${user.id}, status=${resolvedStatus}, plan=${priceId}`,
    );
  }

  /**
   * customer.subscription.deleted
   * La suscripción fue cancelada definitivamente en Stripe.
   * Se ocultan todos los servicios del usuario.
   */
  private async onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const customerId = sub.customer as string;

    const user = await this.userRepo.findOne({
      where: { stripe_customer_id: customerId },
    });
    if (!user) {
      this.logger.warn(
        `customer.subscription.deleted: customer ${customerId} no encontrado`,
      );
      return;
    }

    await this.userRepo.update(user.id, {
      subscription_status: 'cancelled',
      stripe_subscription_id: null,
      stripe_price_id: null,
      current_period_end: null,
    });

    await this.serviceRepo.update({ userId: user.id }, { isVisible: false });

    this.logger.log(`Suscripción cancelada: userId=${user.id}`);
  }
}
