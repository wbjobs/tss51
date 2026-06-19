import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './task.entity';

@Entity()
export class TaskCommand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Task, (task) => task.commands, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column()
  taskId: string;

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'text' })
  command: string;

  @Column({ type: 'varchar', nullable: true })
  label?: string;

  @Column({ type: 'int', default: 0 })
  timeout: number;
}
