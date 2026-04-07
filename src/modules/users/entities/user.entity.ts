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

  @Column({ name: 'subscription_status', type: 'varchar', length: 20, default: 'trial' })
  subscription_status: 'trial' | 'starter' | 'active' | 'past_due' | 'cancelled';

  @Column({ name: 'stripe_customer_id', type: 'varchar', length: 255, nullable: true })
  stripe_customer_id: string | null;

  @Column({ name: 'stripe_subscription_id', type: 'varchar', length: 255, nullable: true })
  stripe_subscription_id: string | null;

  @Column({ name: 'trial_reservation_count', type: 'int', default: 0 })
  trial_reservation_count: number;

  @Column({ name: 'has_spot_addon', type: 'boolean', default: false })
  has_spot_addon: boolean;

  @Column({ name: 'past_due_since', type: 'timestamptz', nullable: true })
  past_due_since: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
