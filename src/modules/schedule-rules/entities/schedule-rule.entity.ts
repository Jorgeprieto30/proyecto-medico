import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Service } from '../../services/entities/service.entity';

/**
 * Define la disponibilidad semanal de un servicio.
 * Cada registro representa un día de la semana con su horario de inicio y fin.
 *
 * day_of_week: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado, 7=Domingo (ISO 8601)
 * start_time / end_time: horas locales del servicio (sin zona horaria), formato "HH:MM:SS"
 */
@Entity('service_schedule_rules')
@Index(['serviceId', 'dayOfWeek'])
export class ScheduleRule {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 1 })
  @Column({ name: 'service_id' })
  serviceId: number;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ApiProperty({
    example: 1,
    description: 'Día de semana ISO: 1=Lunes, 2=Martes, ..., 7=Domingo',
    minimum: 1,
    maximum: 7,
  })
  @Column({ name: 'day_of_week' })
  dayOfWeek: number;

  @ApiProperty({ example: '08:00', description: 'Hora de inicio local (HH:MM)' })
  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @ApiProperty({ example: '20:00', description: 'Hora de fin local (HH:MM)' })
  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @ApiProperty({ example: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-01-01', nullable: true, required: false })
  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: string | null;

  @ApiProperty({ example: '2026-12-31', nullable: true, required: false })
  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
