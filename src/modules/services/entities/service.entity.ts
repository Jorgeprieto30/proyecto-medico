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
