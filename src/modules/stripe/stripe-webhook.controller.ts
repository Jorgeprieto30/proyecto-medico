import {
  BadRequestException,
  Controller,
  Headers,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import Stripe from 'stripe';
import { Public } from '../auth/decorators/public.decorator';
import { StripeService } from './stripe.service';
import { User } from '../users/entities/user.entity';
import { Service } from '../services/entities/service.entity';

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

@ApiExcludeController()
@Public()
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
      // Log el error pero retorna 200 para que Stripe no reintente
      this.logger.error(`Error procesando ${event.type}: ${err.message}`, err.stack);
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
      this.logger.warn('checkout.session.completed sin userId en metadata');
      return;
    }

    if (session.mode !== 'subscription' || !session.subscription) {
      return; // Solo procesamos suscripciones
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
   * Pago mensual exitoso. Actualizamos current_period_end y nos aseguramos
   * de que el status sea correcto (puede haber sido past_due y se recuperó).
   */
  private async onPaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    if (!customerId || invoice.billing_reason === 'subscription_create') {
      // El pago inicial ya lo maneja checkout.session.completed
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

    const priceId = sub.items.data[0]?.price.id;
    const newStatus = priceIdToStatus(priceId) ?? user.subscription_status;

    // Si estaba past_due, lo recuperamos
    const wasPaymentIssue =
      user.subscription_status === 'past_due' || user.subscription_status === 'cancelled';

    await this.userRepo.update(user.id, {
      subscription_status: wasPaymentIssue ? newStatus : user.subscription_status,
      stripe_price_id: priceId,
      current_period_end: periodEnd(sub),
      past_due_since: null,
    });

    // Si se recuperó de past_due, reactivar servicios ocultos
    if (wasPaymentIssue) {
      await this.serviceRepo.update(
        { userId: user.id },
        { isVisible: true },
      );
      this.logger.log(`Servicios reactivados para userId=${user.id}`);
    }

    this.logger.log(
      `Pago renovado: userId=${user.id}, period_end=${periodEnd(sub).toISOString()}`,
    );
  }

  /**
   * invoice.payment_failed
   * El cobro mensual falló. Marcamos past_due y registramos la fecha.
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

    // Solo registramos past_due_since la primera vez
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

    // Ocultar todos los servicios del usuario
    await this.serviceRepo.update({ userId: user.id }, { isVisible: false });

    this.logger.log(`Suscripción cancelada: userId=${user.id}`);
  }
}
