import { Controller, Post, Param, Delete } from '@nestjs/common';
import { SshService } from './ssh.service';

@Controller('api/ssh')
export class SshController {
  constructor(private readonly sshService: SshService) {}

  @Post('connect/:id')
  async connect(@Param('id') id: string) {
    const success = await this.sshService.connect(id);
    return { success };
  }

  @Delete('disconnect/:id')
  disconnect(@Param('id') id: string) {
    this.sshService.disconnect(id);
    return { success: true };
  }

  @Post('connect-all')
  async connectAll() {
    await this.sshService.connectAll();
    return { success: true };
  }

  @Post('disconnect-all')
  disconnectAll() {
    this.sshService.disconnectAll();
    return { success: true };
  }
}
