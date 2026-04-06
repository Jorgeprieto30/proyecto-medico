import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

@Entity('services')
export class Service {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Consulta Médica General' })
  @Column({ length: 255 })
  name: string;

  @ApiPropertyOptional({ example: 'Atención médica general para pacientes', nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ example: 'America/Santiago' })
  @Column({ length: 100, default: 'UTC' })
  timezone: string;

  @ApiProperty({ example: 60, description: 'Duración de cada bloque en minutos' })
  @Column({ name: 'slot_duration_minutes', default: 60 })
  slotDurationMinutes: number;

  @ApiProperty({ example: 20, description: 'Cupos numerados máximos por sesión (clases con lista)' })
  @Column({ name: 'max_spots', default: 20 })
  maxSpots: number;

  @ApiPropertyOptional({ example: 'Bici', description: 'Etiqueta opcional para cada cupo (ej: "Bici", "Silla")', nullable: true })
  @Column({ name: 'spot_label', type: 'varchar', length: 50, nullable: true })
  spotLabel: string | null;

  @ApiProperty({ example: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ example: false, description: 'Si es true, se aplica el plazo mínimo de reserva configurado' })
  @Column({ name: 'booking_cutoff_enabled', default: false })
  bookingCutoffEnabled: boolean;

  @ApiProperty({
    example: 'hours',
    description: 'Modo de cierre de reservas: "hours" = X horas antes del evento, "day_before" = día anterior a las 00:01',
    enum: ['hours', 'day_before'],
  })
  @Column({ name: 'booking_cutoff_mode', type: 'varchar', length: 20, default: 'hours' })
  bookingCutoffMode: 'hours' | 'day_before';

  @ApiProperty({ example: 24, description: 'Horas de anticipación mínima para reservar (solo aplica si booking_cutoff_mode = "hours")' })
  @Column({ name: 'booking_cutoff_hours', default: 24 })
  bookingCutoffHours: number;

  @ApiProperty({ example: 1, description: 'Días de anticipación para el cierre (solo aplica si booking_cutoff_mode = "day_before")' })
  @Column({ name: 'booking_cutoff_days', default: 1 })
  bookingCutoffDays: number;

  @ApiProperty({ example: true, description: 'Si es false, el servicio no es visible en el portal de clientes' })
  @Column({ name: 'is_visible', default: true })
  isVisible: boolean;

  @ApiProperty({ example: 5, description: 'Techo de cupos impuesto por el plan (5 base, 15 con addon)' })
  @Column({ name: 'plan_spot_limit', default: 5 })
  planSpotLimit: number;

  @ApiPropertyOptional({ nullable: true })
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
