import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SshService, CommandOutput, ServerCompleteResult } from '../ssh/ssh.service';
import { ServersService } from '../servers/servers.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/terminal',
})
export class TerminalGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TerminalGateway.name);
  private activeCommands: Set<string> = new Set();

  constructor(
    private sshService: SshService,
    private serversService: ServersService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.broadcastConnectionStatus();
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('execute')
  async handleExecute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { command: string },
  ) {
    const { command } = data;
    
    if (!command || !command.trim()) {
      client.emit('error', { message: 'Command is required' });
      return;
    }

    const commandId = `${client.id}-${Date.now()}`;
    this.activeCommands.add(commandId);

    const connectedServers = this.sshService.getConnectedServers();
    
    if (connectedServers.length === 0) {
      client.emit('output', {
        serverId: 'system',
        serverName: 'System',
        type: 'error',
        data: 'No servers connected. Please connect at least one server first.',
        timestamp: Date.now(),
      });
      this.activeCommands.delete(commandId);
      return;
    }

    client.emit('command-start', {
      commandId,
      command,
      serverCount: connectedServers.length,
      timestamp: Date.now(),
    });

    const totalServers = connectedServers.length;
    const completedServers = new Set<string>();

    const onOutput = (output: CommandOutput) => {
      client.emit('output', output);
    };

    const onServerComplete = (result: ServerCompleteResult) => {
      completedServers.add(result.serverId);
      client.emit('server-complete', {
        commandId,
        ...result,
      });

      if (completedServers.size === totalServers) {
        client.emit('command-complete', {
          commandId,
          timestamp: Date.now(),
        });
        this.activeCommands.delete(commandId);
      }
    };

    try {
      this.sshService.executeCommandOnAll(command, onOutput, onServerComplete);
    } catch (err) {
      this.logger.error(`Command execution failed: ${err.message}`);
      client.emit('error', {
        message: err.message,
        timestamp: Date.now(),
      });
      this.activeCommands.delete(commandId);
    }
  }

  @SubscribeMessage('get-servers')
  async handleGetServers(@ConnectedSocket() client: Socket) {
    const servers = await this.serversService.findAll();
    const serversWithStatus = servers.map((server) => ({
      ...server,
      connected: this.sshService.isConnected(server.id),
    }));
    client.emit('servers', serversWithStatus);
  }

  @SubscribeMessage('connect-server')
  async handleConnectServer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId: string },
  ) {
    const { serverId } = data;
    const success = await this.sshService.connect(serverId);
    
    if (success) {
      const server = await this.serversService.findOne(serverId);
      this.broadcastConnectionStatus();
      client.emit('server-connected', { serverId, server });
    } else {
      client.emit('error', { message: 'Failed to connect to server' });
    }
  }

  @SubscribeMessage('disconnect-server')
  async handleDisconnectServer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId: string },
  ) {
    const { serverId } = data;
    this.sshService.disconnect(serverId);
    this.broadcastConnectionStatus();
    client.emit('server-disconnected', { serverId });
  }

  @SubscribeMessage('connect-all')
  async handleConnectAll(@ConnectedSocket() client: Socket) {
    await this.sshService.connectAll();
    this.broadcastConnectionStatus();
    client.emit('connect-all-complete');
  }

  @SubscribeMessage('disconnect-all')
  handleDisconnectAll(@ConnectedSocket() client: Socket) {
    this.sshService.disconnectAll();
    this.broadcastConnectionStatus();
    client.emit('disconnect-all-complete');
  }

  private async broadcastConnectionStatus() {
    const servers = await this.serversService.findAll();
    const serversWithStatus = servers.map((server) => ({
      ...server,
      connected: this.sshService.isConnected(server.id),
    }));
    this.server.emit('servers-update', serversWithStatus);
  }
}
