import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Service } from '../../services/entities/service.entity';

@Entity('session_spot_overrides')
@Unique(['serviceId', 'slotStart'])
export class SessionSpotOverride {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'service_id' })
  serviceId: string;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ApiProperty({ example: '2026-03-25T14:00:00.000Z' })
  @Column({ name: 'slot_start', type: 'timestamptz' })
  slotStart: Date;

  @ApiProperty({ example: 25 })
  @Column({ name: 'max_spots' })
  maxSpots: number;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
