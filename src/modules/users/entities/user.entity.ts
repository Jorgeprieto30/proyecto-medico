import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true, select: false })
  password_hash: string;

  @Column({ nullable: true })
  google_id: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ default: 'admin' })
  role: string;

  @Column({ name: 'center_name', type: 'varchar', length: 255, nullable: true })
  center_name: string | null;

  @Column({ name: 'center_code', type: 'varchar', length: 100, nullable: true, unique: true })
  center_code: string | null;

  @Column({ name: 'reset_password_token', type: 'varchar', length: 64, nullable: true, select: false })
  reset_password_token: string | null;

  @Column({ name: 'reset_password_expires', type: 'timestamptz', nullable: true, select: false })
  reset_password_expires: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
