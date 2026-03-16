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
 * Define la capacidad (cupos) para un tramo horario específico dentro de un día de semana.
 *
 * Ejemplo:
 *   Lunes 08:00–09:00 → 5 cupos
 *   Lunes 09:00–10:00 → 3 cupos
 *
 * Al generar slots, cada slot busca el bloque cuyo rango de tiempo lo contenga.
 * Si un slot no tiene bloque configurado, no tiene capacidad y no es reservable.
 *
 * day_of_week: 1=Lunes ... 7=Domingo (ISO 8601)
 */
@Entity('service_schedule_blocks')
@Index(['serviceId', 'dayOfWeek'])
export class ScheduleBlock {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Column({ name: 'service_id' })
  serviceId: string;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ApiProperty({
    example: 1,
    description: 'Día de semana ISO: 1=Lunes, ..., 7=Domingo',
    minimum: 1,
    maximum: 7,
  })
  @Column({ name: 'day_of_week' })
  dayOfWeek: number;

  @ApiProperty({ example: '08:00', description: 'Inicio del tramo (HH:MM)' })
  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @ApiProperty({ example: '09:00', description: 'Fin del tramo (HH:MM)' })
  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @ApiProperty({ example: 5, description: 'Número de cupos disponibles en este tramo' })
  @Column({ default: 1 })
  capacity: number;

  @ApiProperty({ example: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
