import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { User } from '../users/entities/user.entity';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new InternalServerErrorException('STRIPE_SECRET_KEY no configurado');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  // ─── Clientes ─────────────────────────────────────────────────────────────

  /**
   * Crea un Customer en Stripe y retorna su ID.
   *
   * @param user           - Datos del usuario (email + nombre).
   * @param idempotencyKey - Clave de idempotencia (Parche #3): Stripe deduplica
   *                         si se llama dos veces con la misma clave en 24h.
   *                         Usar formato `customer-{userId}`.
   */
  async createCustomer(
    user: Pick<User, 'email' | 'name'>,
    idempotencyKey: string,
  ): Promise<string> {
    const customer = await this.stripe.customers.create(
      {
        email: user.email,
        name: user.name,
        metadata: { source: 'agenda-cupos' },
      },
      { idempotencyKey },
    );
    return customer.id;
  }

  /**
   * Elimina un Customer en Stripe.
   * Usado para limpiar duplicados cuando la race condition en createCustomer
   * resulta en un Customer que no fue guardado en BD (Parche #3).
   */
  async deleteCustomer(customerId: string): Promise<void> {
    try {
      await this.stripe.customers.del(customerId);
      this.logger.log(`Customer duplicado eliminado de Stripe: ${customerId}`);
    } catch (err: any) {
      // No crítico: el Customer quedará huérfano pero no causa problemas de facturación
      this.logger.warn(`No se pudo eliminar Customer duplicado ${customerId}: ${err.message}`);
    }
  }

  // ─── Checkout ─────────────────────────────────────────────────────────────

  /**
   * Crea una sesión de Checkout para que el usuario pague su suscripción.
   *
   * @param user       - Usuario autenticado (debe tener stripe_customer_id).
   * @param priceId    - ID del precio en Stripe. Siempre viene de env vars, nunca del cliente.
   * @param successUrl - URL a la que Stripe redirige tras el pago exitoso.
   * @param cancelUrl  - URL a la que Stripe redirige si el usuario cancela.
   */
  async createCheckoutSession(
    user: Pick<User, 'id' | 'stripe_customer_id'>,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> {
    if (!user.stripe_customer_id) {
      throw new InternalServerErrorException(
        'El usuario no tiene un Customer de Stripe. Llama a createCustomer primero.',
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: user.stripe_customer_id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      // userId en metadata para identificar al usuario en el webhook checkout.session.completed
      metadata: { userId: user.id },
    });

    return session.url!;
  }

  // ─── Portal de cliente ────────────────────────────────────────────────────

  /**
   * Crea una sesión del Customer Portal para que el usuario gestione
   * su suscripción (cambio de tarjeta, cancelación, upgrade/downgrade).
   *
   * @param user      - Usuario autenticado (debe tener stripe_customer_id).
   * @param returnUrl - URL a la que Stripe redirige al salir del portal.
   */
  async createPortalSession(
    user: Pick<User, 'stripe_customer_id'>,
    returnUrl: string,
  ): Promise<string> {
    if (!user.stripe_customer_id) {
      throw new InternalServerErrorException(
        'El usuario no tiene un Customer de Stripe asociado.',
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl,
    });

    return session.url;
  }

  // ─── Webhooks ─────────────────────────────────────────────────────────────

  /**
   * Verifica la firma HMAC del webhook y retorna el evento tipado.
   * Lanza un error si la firma no es válida — imposible de falsificar
   * sin conocer STRIPE_WEBHOOK_SECRET.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET no configurado');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Recupera una suscripción de Stripe por su ID.
   * Se usa en los webhooks para obtener el estado más reciente antes de actualizar BD.
   */
  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }
}
