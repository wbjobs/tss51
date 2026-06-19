import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, JoinColumn } from 'typeorm';
import { TaskCommand } from './task-command.entity';

export type TaskExecutionStatus = 'pending' | 'running' | 'success' | 'failed';

@Entity()
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => TaskCommand, (cmd) => cmd.task, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  commands: TaskCommand[];

  @Column({ type: 'varchar', default: 'pending' })
  lastExecutionStatus?: TaskExecutionStatus;

  @Column({ type: 'datetime', nullable: true })
  lastExecutionAt?: Date;

  @Column({ default: false })
  stopOnError: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
