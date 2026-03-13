import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('services')
export class Service {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Consulta Médica General' })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({ example: 'Atención médica general para pacientes', nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ example: 'America/Santiago' })
  @Column({ length: 100, default: 'UTC' })
  timezone: string;

  @ApiProperty({ example: 60, description: 'Duración de cada bloque en minutos' })
  @Column({ name: 'slot_duration_minutes', default: 60 })
  slotDurationMinutes: number;

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
