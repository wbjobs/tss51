export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  connected: boolean;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServerDto {
  name: string;
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface UpdateServerDto {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface CommandOutput {
  serverId: string;
  serverName: string;
  type: 'stdout' | 'stderr' | 'error' | 'exit' | 'system';
  data: string;
  code?: number;
  timestamp: number;
}

export interface ServerOutput {
  serverId: string;
  serverName: string;
  outputs: CommandOutput[];
  connected: boolean;
}
