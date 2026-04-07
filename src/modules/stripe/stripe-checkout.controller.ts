import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeService } from './stripe.service';
import { User } from '../users/entities/user.entity';

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  (process.env.FRONTEND_URLS ?? 'http://localhost:3001').split(',')[0].trim();

class CreateCheckoutDto {
  @IsIn(['starter', 'active'])
  plan: 'starter' | 'active';
}

@ApiTags('stripe')
@ApiBearerAuth()
@Controller('stripe')
export class StripeCheckoutController {
  constructor(
    private readonly stripeService: StripeService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * POST /stripe/checkout
   * Crea una sesión de Stripe Checkout y retorna la URL de pago.
   * El frontend redirige al usuario a esa URL.
   */
  @Post('checkout')
  @ApiOperation({ summary: 'Crear sesión de Stripe Checkout para suscribirse' })
  @ApiBody({ schema: { example: { plan: 'starter' } } })
  async createCheckout(
    @Req() req: any,
    @Body() dto: CreateCheckoutDto,
  ): Promise<{ url: string }> {
    const user = await this.userRepo.findOne({ where: { id: req.user.id } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');

    // Asegurar que el usuario tiene un Customer en Stripe
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      customerId = await this.stripeService.createCustomer(user);
      await this.userRepo.update(user.id, { stripe_customer_id: customerId });
      user.stripe_customer_id = customerId;
    }

    const priceEnvVar =
      dto.plan === 'starter'
        ? process.env.STRIPE_PRICE_BASIC
        : process.env.STRIPE_PRICE_PRO;

    if (!priceEnvVar) {
      throw new BadRequestException(
        `Variable de entorno STRIPE_PRICE_${dto.plan === 'starter' ? 'BASIC' : 'PRO'} no configurada`,
      );
    }

    const url = await this.stripeService.createCheckoutSession(
      user,
      priceEnvVar,
      `${FRONTEND_URL}/planes?success=1`,
      `${FRONTEND_URL}/planes?cancelled=1`,
    );

    return { url };
  }

  /**
   * POST /stripe/portal
   * Crea una sesión del Customer Portal para gestionar la suscripción.
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

    const url = await this.stripeService.createPortalSession(
      user,
      `${FRONTEND_URL}/planes`,
    );

    return { url };
  }
}
