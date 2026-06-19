import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, ClientChannel } from 'ssh2';
import { Server } from '../servers/server.entity';
import { ServersService } from '../servers/servers.service';

export interface CommandOutput {
  serverId: string;
  serverName: string;
  type: 'stdout' | 'stderr' | 'error' | 'exit';
  data: string;
  code?: number;
  timestamp: number;
}

export interface SshConnection {
  client: Client;
  server: Server;
  connected: boolean;
}

@Injectable()
export class SshService implements OnModuleInit {
  private readonly logger = new Logger(SshService.name);
  private connections: Map<string, SshConnection> = new Map();

  constructor(private serversService: ServersService) {}

  async onModuleInit() {
    this.logger.log('SSH Service initialized');
  }

  async connect(serverId: string): Promise<boolean> {
    const server = await this.serversService.findOne(serverId);
    
    if (this.connections.has(serverId)) {
      const conn = this.connections.get(serverId);
      if (conn.connected) {
        return true;
      }
    }

    return new Promise((resolve) => {
      const client = new Client();

      client.on('ready', () => {
        this.logger.log(`Connected to ${server.name} (${server.host})`);
        this.connections.set(serverId, {
          client,
          server,
          connected: true,
        });
        this.serversService.updateConnectionStatus(serverId, true);
        resolve(true);
      });

      client.on('error', (err) => {
        this.logger.error(`SSH error for ${server.name}: ${err.message}`);
        this.serversService.updateConnectionStatus(serverId, false, err.message);
        this.cleanupConnection(serverId);
        resolve(false);
      });

      client.on('close', () => {
        this.logger.log(`Connection closed to ${server.name}`);
        this.serversService.updateConnectionStatus(serverId, false);
        this.cleanupConnection(serverId);
      });

      client.on('end', () => {
        this.cleanupConnection(serverId);
      });

      try {
        const connectConfig: any = {
          host: server.host,
          port: server.port,
          username: server.username,
          readyTimeout: 10000,
          keepaliveInterval: 30000,
        };

        if (server.privateKey) {
          connectConfig.privateKey = server.privateKey;
          if (server.passphrase) {
            connectConfig.passphrase = server.passphrase;
          }
        } else if (server.password) {
          connectConfig.password = server.password;
        } else {
          this.serversService.updateConnectionStatus(
            serverId,
            false,
            'No authentication method configured',
          );
          resolve(false);
          return;
        }

        client.connect(connectConfig);
      } catch (err) {
        this.logger.error(`Failed to connect to ${server.name}: ${err.message}`);
        this.serversService.updateConnectionStatus(serverId, false, err.message);
        resolve(false);
      }
    });
  }

  disconnect(serverId: string): void {
    const conn = this.connections.get(serverId);
    if (conn) {
      try {
        conn.client.end();
      } catch (err) {
        this.logger.error(`Error disconnecting: ${err.message}`);
      }
      this.cleanupConnection(serverId);
    }
  }

  private cleanupConnection(serverId: string): void {
    this.connections.delete(serverId);
  }

  async connectAll(): Promise<void> {
    const servers = await this.serversService.findAll();
    for (const server of servers) {
      this.connect(server.id).catch((err) => {
        this.logger.error(`Auto-connect failed for ${server.name}: ${err.message}`);
      });
    }
  }

  disconnectAll(): void {
    for (const serverId of this.connections.keys()) {
      this.disconnect(serverId);
    }
  }

  isConnected(serverId: string): boolean {
    const conn = this.connections.get(serverId);
    return conn?.connected || false;
  }

  getConnectedServers(): Server[] {
    const servers: Server[] = [];
    for (const conn of this.connections.values()) {
      if (conn.connected) {
        servers.push(conn.server);
      }
    }
    return servers;
  }

  executeCommand(
    serverId: string,
    command: string,
    onOutput: (output: CommandOutput) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.connections.get(serverId);
      if (!conn || !conn.connected) {
        const error: CommandOutput = {
          serverId,
          serverName: conn?.server?.name || 'Unknown',
          type: 'error',
          data: 'Not connected to server',
          timestamp: Date.now(),
        };
        onOutput(error);
        resolve();
        return;
      }

      const server = conn.server;
      let stdoutData = '';
      let stderrData = '';

      conn.client.exec(command, (err, stream) => {
        if (err) {
          const error: CommandOutput = {
            serverId,
            serverName: server.name,
            type: 'error',
            data: err.message,
            timestamp: Date.now(),
          };
          onOutput(error);
          resolve();
          return;
        }

        stream.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdoutData += chunk;
          onOutput({
            serverId,
            serverName: server.name,
            type: 'stdout',
            data: chunk,
            timestamp: Date.now(),
          });
        });

        stream.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stderrData += chunk;
          onOutput({
            serverId,
            serverName: server.name,
            type: 'stderr',
            data: chunk,
            timestamp: Date.now(),
          });
        });

        stream.on('close', (code: number) => {
          onOutput({
            serverId,
            serverName: server.name,
            type: 'exit',
            data: code === 0 ? 'Command completed successfully' : `Command failed with code ${code}`,
            code,
            timestamp: Date.now(),
          });
          resolve();
        });

        stream.on('error', (err: Error) => {
          onOutput({
            serverId,
            serverName: server.name,
            type: 'error',
            data: err.message,
            timestamp: Date.now(),
          });
          resolve();
        });
      });
    });
  }

  async executeCommandOnAll(
    command: string,
    onOutput: (output: CommandOutput) => void,
  ): Promise<void> {
    const connectedServers = this.getConnectedServers();
    
    if (connectedServers.length === 0) {
      return;
    }

    const promises = connectedServers.map((server) =>
      this.executeCommand(server.id, command, onOutput),
    );

    await Promise.all(promises);
  }
}
