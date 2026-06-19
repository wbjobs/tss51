import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Server } from './servers/server.entity';
import { ServersModule } from './servers/servers.module';
import { SshModule } from './ssh/ssh.module';
import { TerminalModule } from './terminal/terminal.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: './data/ssh-cluster.db',
      entities: [Server],
      synchronize: true,
      logging: false,
    }),
    ServersModule,
    SshModule,
    TerminalModule,
  ],
})
export class AppModule {}
