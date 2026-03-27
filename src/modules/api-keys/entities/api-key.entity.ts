import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Primeros 10 chars de la clave (para identificarla en la lista)
  @Column()
  prefix: string;

  // SHA-256 del token completo (nunca se devuelve en queries normales)
  @Column({ select: false })
  key_hash: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  last_used_at: Date;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  created_at: Date;
}
