import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Member } from './member.entity';
import { User } from '../../users/entities/user.entity';

@Entity('member_center_visits')
@Unique(['memberId', 'centerUserId'])
export class MemberCenterVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'center_user_id', type: 'uuid' })
  centerUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'center_user_id' })
  centerUser: User;

  @CreateDateColumn({ name: 'first_visited_at' })
  first_visited_at: Date;

  @UpdateDateColumn({ name: 'last_visited_at' })
  last_visited_at: Date;
}
