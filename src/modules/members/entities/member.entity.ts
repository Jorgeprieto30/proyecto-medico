import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('members')
export class Member {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'María' })
  @Column({ name: 'first_name', length: 255 })
  first_name: string;

  @ApiProperty({ example: 'González' })
  @Column({ name: 'last_name', length: 255 })
  last_name: string;

  @ApiProperty({ example: 'maria@example.com' })
  @Column({ unique: true })
  email: string;

  @ApiPropertyOptional({ example: '12345678-9', nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  rut: string | null;

  @ApiPropertyOptional({ example: '1990-05-20', nullable: true })
  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birth_date: string | null;

  @Column({ name: 'password_hash', nullable: true, select: false })
  password_hash: string | null;

  @Column({ name: 'reset_password_token', type: 'varchar', length: 64, nullable: true, select: false })
  reset_password_token: string | null;

  @Column({ name: 'reset_password_expires', type: 'timestamptz', nullable: true, select: false })
  reset_password_expires: Date | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
