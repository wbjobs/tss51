import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { TaskCommand } from './task-command.entity';
import { TasksService } from './tasks.service';
import { TaskExecutionService } from './task-execution.service';
import { TasksController } from './tasks.controller';
import { SshModule } from '../ssh/ssh.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskCommand]),
    SshModule,
  ],
  providers: [TasksService, TaskExecutionService],
  controllers: [TasksController],
  exports: [TasksService, TaskExecutionService],
})
export class TasksModule {}
