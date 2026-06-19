import { Module } from '@nestjs/common';
import { TerminalGateway } from './terminal.gateway';
import { SshModule } from '../ssh/ssh.module';
import { ServersModule } from '../servers/servers.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [SshModule, ServersModule, TasksModule],
  providers: [TerminalGateway],
})
export class TerminalModule {}
