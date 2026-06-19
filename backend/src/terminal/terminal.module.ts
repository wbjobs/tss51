import { Module } from '@nestjs/common';
import { TerminalGateway } from './terminal.gateway';
import { SshModule } from '../ssh/ssh.module';
import { ServersModule } from '../servers/servers.module';

@Module({
  imports: [SshModule, ServersModule],
  providers: [TerminalGateway],
})
export class TerminalModule {}
