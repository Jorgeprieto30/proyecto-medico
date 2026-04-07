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
   * Llamar una sola vez al registrar el usuario.
   */
  async createCustomer(user: Pick<User, 'email' | 'name'>): Promise<string> {
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { source: 'agenda-cupos' },
    });
    return customer.id;
  }

  // ─── Checkout ─────────────────────────────────────────────────────────────

  /**
   * Crea una sesión de Checkout para que el usuario pague su suscripción.
   *
   * @param user       - Usuario autenticado (debe tener stripe_customer_id).
   * @param priceId    - ID del precio en Stripe (ej. process.env.STRIPE_PRICE_BASICO).
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
      // Permite al usuario cambiar la cantidad de asientos en el futuro
      allow_promotion_codes: true,
      // Datos que vuelven en el webhook checkout.session.completed
      metadata: { userId: user.id },
    });

    return session.url!;
  }

  // ─── Portal de cliente ────────────────────────────────────────────────────

  /**
   * Crea una sesión del Customer Portal para que el usuario gestione
   * su suscripción (cambio de tarjeta, cancelación, upgrade/downgrade).
   *
   * @param user        - Usuario autenticado (debe tener stripe_customer_id).
   * @param returnUrl   - URL a la que Stripe redirige al salir del portal.
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
   * Verifica la firma del webhook y retorna el evento tipado.
   * Lanza un error si la firma no es válida.
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
   */
  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }
}
