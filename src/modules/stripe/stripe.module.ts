import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Service } from '../services/entities/service.entity';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeCheckoutController } from './stripe-checkout.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Service])],
  controllers: [StripeWebhookController, StripeCheckoutController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
