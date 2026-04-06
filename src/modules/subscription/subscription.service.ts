import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { User } from '../users/entities/user.entity';
import { Service } from '../services/entities/service.entity';
import { Reservation } from '../reservations/entities/reservation.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
  ) {}

  /**
   * Verifica si el agente puede crear un nuevo servicio.
   * Lanza ForbiddenException con { code, message } si no puede.
   */
  async checkCanCreateService(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return; // usuario no encontrado: dejar pasar (la validación de owner la hace ServicesService)

    switch (user.subscription_status) {
      case 'cancelled':
        throw new ForbiddenException({
          code: 'SUBSCRIPTION_CANCELLED',
          message: 'Tu suscripción está cancelada. Renueva tu plan para crear servicios.',
        });

      case 'past_due':
        this.assertGracePeriod(user);
        break;

      case 'trial': {
        const activeCount = await this.serviceRepo.count({
          where: { userId: user.id, isActive: true },
        });
        if (activeCount >= 1) {
          throw new ForbiddenException({
            code: 'TRIAL_LIMIT_SERVICES',
            message: 'En el plan trial solo puedes tener 1 servicio activo. Suscríbete para crear más.',
          });
        }
        break;
      }

      // 'active': sin restricción
    }
  }

  /**
   * Verifica si se puede crear una reserva en el servicio del agente indicado.
   * Lanza ForbiddenException con { code, message } si no puede.
   */
  async checkCanCreateReservation(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return; // servicio sin owner: dejar pasar

    switch (user.subscription_status) {
      case 'cancelled':
        throw new ForbiddenException({
          code: 'SUBSCRIPTION_CANCELLED',
          message: 'El servicio no está disponible.',
        });

      case 'past_due':
        this.assertGracePeriod(user);
        break;

      case 'trial':
        if (user.trial_reservation_count >= 3) {
          throw new ForbiddenException({
            code: 'TRIAL_LIMIT_RESERVATIONS',
            message: 'Se alcanzó el límite de 3 reservas del plan trial. Suscríbete para continuar.',
          });
        }
        break;

      // 'active': sin restricción
    }
  }

  /**
   * Incrementa el contador de reservas trial del agente.
   * Es un no-op para usuarios que no están en trial.
   */
  async incrementTrialCount(userId: string): Promise<void> {
    await this.userRepo.increment(
      { id: userId, subscription_status: 'trial' },
      'trial_reservation_count',
      1,
    );
  }

  /**
   * Pone is_visible=false en todos los servicios de agentes con suscripción
   * cancelada o con grace period vencido.
   * Llamar desde el webhook de Stripe (Paso 4).
   */
  async enforceVisibility(): Promise<void> {
    const fiveDaysAgo = DateTime.now().toUTC().minus({ days: 5 }).toJSDate();

    const [pastDueUsers, cancelledUsers] = await Promise.all([
      this.userRepo.find({
        where: { subscription_status: 'past_due', past_due_since: LessThan(fiveDaysAgo) },
        select: ['id'],
      }),
      this.userRepo.find({
        where: { subscription_status: 'cancelled' },
        select: ['id'],
      }),
    ]);

    const affectedIds = [
      ...pastDueUsers.map((u) => u.id),
      ...cancelledUsers.map((u) => u.id),
    ];

    if (affectedIds.length === 0) return;

    await this.serviceRepo.update({ userId: In(affectedIds) }, { isVisible: false });
  }

  // ─── private ─────────────────────────────────────────────────────────────

  private assertGracePeriod(user: User): void {
    if (!user.past_due_since) return; // sin fecha registrada: dentro del grace

    const graceExpires = DateTime.fromJSDate(user.past_due_since).plus({ days: 5 });
    if (DateTime.now().toUTC() >= graceExpires.toUTC()) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_PAST_DUE',
        message: 'Tu suscripción está vencida. Actualiza tu método de pago para continuar.',
      });
    }
  }
}
