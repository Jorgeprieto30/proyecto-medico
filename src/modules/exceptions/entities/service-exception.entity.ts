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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Service } from '../../services/entities/service.entity';

/**
 * Excepción para una fecha específica.
 *
 * Casos de uso:
 * 1. Cierre completo del día:         is_closed=true, start_time=null, end_time=null
 * 2. Cierre de un tramo específico:   is_closed=true, start_time='12:00', end_time='13:00'
 * 3. Capacidad especial en un tramo:  is_closed=false, capacity_override=2, start_time='15:00', end_time='16:00'
 * 4. Cambio de horario del día:       is_closed=false, start_time='10:00', end_time='18:00' (sin capacity_override)
 *
 * Las excepciones siempre tienen prioridad sobre las reglas semanales.
 */
@Entity('service_exceptions')
@Index(['serviceId', 'exceptionDate'])
export class ServiceException {
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
    example: '2026-03-21',
    description: 'Fecha de la excepción (YYYY-MM-DD)',
  })
  @Column({ name: 'exception_date', type: 'date' })
  exceptionDate: string;

  @ApiPropertyOptional({
    example: '12:00',
    description: 'Si se especifica, la excepción aplica solo desde esta hora',
    nullable: true,
  })
  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime: string | null;

  @ApiPropertyOptional({
    example: '13:00',
    description: 'Si se especifica, la excepción aplica solo hasta esta hora',
    nullable: true,
  })
  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime: string | null;

  @ApiProperty({
    example: true,
    description: 'Si es true, cierra el día completo (o el tramo si hay start/end_time)',
  })
  @Column({ name: 'is_closed', default: false })
  isClosed: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: 'Capacidad alternativa para este tramo/día. Solo aplica si is_closed=false',
    nullable: true,
  })
  @Column({ name: 'capacity_override', type: 'integer', nullable: true })
  capacityOverride: number | null;

  @ApiPropertyOptional({
    example: 'Feriado nacional',
    description: 'Razón o comentario de la excepción',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
