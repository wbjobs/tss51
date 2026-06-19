import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Server } from './servers/server.entity';
import { Task } from './tasks/task.entity';
import { TaskCommand } from './tasks/task-command.entity';
import { ServersModule } from './servers/servers.module';
import { SshModule } from './ssh/ssh.module';
import { TerminalModule } from './terminal/terminal.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: './data/ssh-cluster.db',
      entities: [Server, Task, TaskCommand],
      synchronize: true,
      logging: false,
    }),
    ServersModule,
    SshModule,
    TerminalModule,
    TasksModule,
  ],
})
export class AppModule {}
