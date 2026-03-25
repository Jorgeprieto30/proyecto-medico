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
import { Member } from '../../members/entities/member.entity';

export enum ReservationStatus {
  CONFIRMED = 'confirmed',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
}

@Entity('reservations')
@Index(['serviceId', 'slotStart'])
@Index(['serviceId', 'slotStart', 'status'])
export class Reservation {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Column({ name: 'service_id' })
  serviceId: string;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ApiProperty({ example: '2026-03-20T12:00:00.000Z' })
  @Column({ name: 'slot_start', type: 'timestamptz' })
  slotStart: Date;

  @ApiProperty({ example: '2026-03-20T13:00:00.000Z' })
  @Column({ name: 'slot_end', type: 'timestamptz' })
  slotEnd: Date;

  @ApiProperty({ enum: ReservationStatus, example: ReservationStatus.CONFIRMED })
  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.CONFIRMED,
  })
  status: ReservationStatus;

  @ApiPropertyOptional({ example: 'Jorge Prieto', nullable: true })
  @Column({ name: 'customer_name', type: 'varchar', nullable: true, length: 255 })
  customerName: string | null;

  @ApiPropertyOptional({ example: 'client_123', nullable: true })
  @Column({ name: 'customer_external_id', type: 'varchar', nullable: true, length: 255 })
  customerExternalId: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  @Column({ name: 'member_id', type: 'uuid', nullable: true })
  memberId: string | null;

  @ManyToOne(() => Member, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'member_id' })
  member: Member | null;

  @ApiPropertyOptional({ example: 5, nullable: true, description: 'Número de cupo elegido (1..max_spots)' })
  @Column({ name: 'spot_number', type: 'int', nullable: true })
  spotNumber: number | null;

  @ApiPropertyOptional({ example: { source: 'internal' }, nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
