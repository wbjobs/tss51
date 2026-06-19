import { Module } from '@nestjs/common';
import { SshService } from './ssh.service';
import { SshController } from './ssh.controller';
import { ServersModule } from '../servers/servers.module';

@Module({
  imports: [ServersModule],
  providers: [SshService],
  controllers: [SshController],
  exports: [SshService],
})
export class SshModule {}
