import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { User } from '../users/entities/user.entity';
import { Service } from '../services/entities/service.entity';
import { Reservation } from '../reservations/entities/reservation.entity';

/** Límites por plan */
const PLAN_LIMITS = {
  trial:   { maxServices: 1,  maxSpots: null }, // sin límite de cupos; limitado por reservas totales
  starter: { maxServices: 3,  maxSpots: 20   },
  active:  { maxServices: 10, maxSpots: 50   },
} as const;

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
   * Verifica si el agente puede crear un nuevo servicio según su plan.
   * Lanza ForbiddenException con { code, message } si no puede.
   */
  async checkCanCreateService(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    switch (user.subscription_status) {
      case 'cancelled':
        throw new ForbiddenException({
          code: 'SUBSCRIPTION_CANCELLED',
          message: 'Tu suscripción está cancelada. Renueva tu plan para crear servicios.',
        });

      case 'past_due':
        this.assertGracePeriod(user);
        break;

      case 'trial':
      case 'starter':
      case 'active': {
        const limits = PLAN_LIMITS[user.subscription_status];
        const activeCount = await this.serviceRepo.count({
          where: { userId: user.id, isActive: true },
        });
        if (activeCount >= limits.maxServices) {
          const planName = { trial: 'Trial', starter: 'Básico', active: 'Pro' }[user.subscription_status];
          throw new ForbiddenException({
            code: 'PLAN_LIMIT_SERVICES',
            message: `El plan ${planName} permite máximo ${limits.maxServices} evento(s) activo(s). Actualiza tu plan para crear más.`,
          });
        }
        break;
      }
    }
  }

  /**
   * Verifica que los cupos solicitados no excedan el límite del plan.
   * Llamar al crear o actualizar un servicio cuando maxSpots cambia.
   */
  async checkServiceSpotLimit(userId: string, maxSpots: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    const limits = PLAN_LIMITS[user.subscription_status as keyof typeof PLAN_LIMITS];
    if (!limits || limits.maxSpots === null) return; // trial sin límite de cupos

    if (maxSpots > limits.maxSpots) {
      const planName = { trial: 'Trial', starter: 'Básico', active: 'Pro' }[user.subscription_status] ?? user.subscription_status;
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_SPOTS',
        message: `El plan ${planName} permite máximo ${limits.maxSpots} cupos por evento. Actualiza tu plan para aumentar la capacidad.`,
      });
    }
  }

  /**
   * Verifica si se puede crear una reserva en el servicio del agente indicado.
   * Lanza ForbiddenException con { code, message } si no puede.
   */
  async checkCanCreateReservation(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

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

      // 'starter' y 'active': reservas ilimitadas
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
