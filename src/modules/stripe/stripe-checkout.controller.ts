import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeService } from './stripe.service';
import { User } from '../users/entities/user.entity';

class CreateCheckoutDto {
  @IsIn(['starter', 'active'])
  plan: 'starter' | 'active';
}

@ApiTags('stripe')
@ApiBearerAuth()
@Controller('stripe')
export class StripeCheckoutController {
  private readonly logger = new Logger(StripeCheckoutController.name);

  constructor(
    private readonly stripeService: StripeService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Resuelve la URL base del frontend en cada request (Parche #6).
   * Evitar evaluar env vars en boot time — pueden no estar disponibles aún.
   */
  private getFrontendUrl(): string {
    return (
      process.env.FRONTEND_URL ||
      (process.env.FRONTEND_URLS ?? '').split(',')[0].trim() ||
      'http://localhost:3001'
    );
  }

  /**
   * POST /stripe/checkout
   * Crea una sesión de Stripe Checkout y retorna la URL de pago.
   *
   * Parches aplicados:
   *   #3 — Race condition en createCustomer: UPDATE atómico + idempotency key
   *   #4 — Bloquea checkout si el usuario ya tiene suscripción activa
   *   #6 — FRONTEND_URL resuelto por request, no en boot
   */
  @Post('checkout')
  @ApiOperation({ summary: 'Crear sesión de Stripe Checkout para suscribirse' })
  @ApiBody({ schema: { example: { plan: 'starter' } } })
  async createCheckout(
    @Req() req: any,
    @Body() dto: CreateCheckoutDto,
  ): Promise<{ url: string }> {
    let user = await this.userRepo.findOne({ where: { id: req.user.id } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');

    // Parche #4: impedir suscripción doble si ya tiene plan pagado activo.
    // El usuario debe usar el Portal para cambiar de plan, no crear otra sesión.
    if (
      user.stripe_subscription_id &&
      (user.subscription_status === 'starter' || user.subscription_status === 'active')
    ) {
      throw new BadRequestException({
        code: 'ALREADY_SUBSCRIBED',
        message:
          'Ya tienes una suscripción activa. Usa el portal para cambiar de plan o gestionar tu facturación.',
      });
    }

    // Parche #3: creación atómica del Customer en Stripe para evitar race conditions.
    // Si dos requests llegan simultáneamente ambas ven stripe_customer_id = null,
    // ambas crearían un Customer distinto. El UPDATE atómico garantiza que solo
    // uno gana; el perdedor limpia el Customer que creó en Stripe.
    if (!user.stripe_customer_id) {
      // La idempotency key basada en userId garantiza que Stripe deduplica
      // si Stripe recibe dos llamadas iguales antes de que nuestra BD se actualice.
      const newCustomerId = await this.stripeService.createCustomer(
        user,
        `customer-${user.id}`,
      );

      // UPDATE atómico: solo escribe si stripe_customer_id sigue siendo NULL.
      // El primero en llegar gana; el segundo no afecta ninguna fila (affected = 0).
      const result = await this.userRepo
        .createQueryBuilder()
        .update(User)
        .set({ stripe_customer_id: newCustomerId })
        .where('id = :id AND stripe_customer_id IS NULL', { id: user.id })
        .execute();

      if (result.affected === 0) {
        // Otro request ganó la carrera. Recargamos el usuario para obtener el ID ganador.
        user = await this.userRepo.findOne({ where: { id: req.user.id } });
        if (!user?.stripe_customer_id) {
          throw new InternalServerErrorException(
            'Error al asignar Customer de Stripe. Intenta de nuevo.',
          );
        }
        // Solo eliminamos el customer duplicado si es distinto al del ganador.
        // Si Stripe devolvió el mismo ID (por idempotency key), el ganador ya lo guardó.
        if (newCustomerId !== user.stripe_customer_id) {
          this.logger.warn(
            `Race condition detectada en createCustomer para userId=${user.id}. Eliminando duplicado ${newCustomerId}.`,
          );
          await this.stripeService.deleteCustomer(newCustomerId);
        }
      } else {
        user.stripe_customer_id = newCustomerId;
      }
    }

    // El priceId SIEMPRE viene de variables de entorno del servidor, nunca del cliente.
    const priceEnvVar =
      dto.plan === 'starter'
        ? process.env.STRIPE_PRICE_BASIC
        : process.env.STRIPE_PRICE_PRO;

    if (!priceEnvVar) {
      throw new BadRequestException(
        `Variable de entorno STRIPE_PRICE_${dto.plan === 'starter' ? 'BASIC' : 'PRO'} no configurada`,
      );
    }

    // Parche #6: resolver URL por request para evitar que quede como localhost
    // si la variable de entorno no estaba disponible durante el boot.
    const frontendUrl = this.getFrontendUrl();

    const url = await this.stripeService.createCheckoutSession(
      user,
      priceEnvVar,
      `${frontendUrl}/planes?success=1`,
      `${frontendUrl}/planes?cancelled=1`,
    );

    return { url };
  }

  /**
   * POST /stripe/portal
   * Crea una sesión del Customer Portal para gestionar la suscripción
   * (cambiar tarjeta, cancelar, hacer upgrade/downgrade).
   */
  @Post('portal')
  @ApiOperation({ summary: 'Crear sesión del Customer Portal de Stripe' })
  async createPortal(@Req() req: any): Promise<{ url: string }> {
    const user = await this.userRepo.findOne({ where: { id: req.user.id } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');

    if (!user.stripe_customer_id) {
      throw new BadRequestException(
        'No tienes una suscripción activa de Stripe para gestionar.',
      );
    }

    // Parche #6: resolver URL por request
    const frontendUrl = this.getFrontendUrl();

    const url = await this.stripeService.createPortalSession(
      user,
      `${frontendUrl}/planes`,
    );

    return { url };
  }
}
