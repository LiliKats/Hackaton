import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { Exclude } from 'class-transformer';
import { LeaveRequest } from '../../leave-requests/entities/leave-request.entity';
import { Team } from '../../teams/entities/team.entity';

export enum UserRole {
  EMPLOYEE = 'employee',
  MANAGER = 'manager',
  HR = 'hr',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.EMPLOYEE,
  })
  role: UserRole;

  @Column({ nullable: true })
  position: string;

  @Column({ nullable: true })
  department: string;

  @Column({ type: 'date', nullable: true })
  hireDate: Date;

  @Column({ type: 'int', default: 20 })
  annualLeaveDays: number;

  @Column({ type: 'float', default: 0 })
  usedLeaveDays: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Team, (team) => team.members, { nullable: true })
  team: Team;

  @ManyToOne(() => User, (user) => user.subordinates, { nullable: true })
  manager: User;

  @OneToMany(() => User, (user) => user.manager)
  subordinates: User[];

  @OneToMany(() => LeaveRequest, (leaveRequest) => leaveRequest.user)
  leaveRequests: LeaveRequest[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
