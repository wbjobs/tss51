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

export type TaskExecutionStatus = 'pending' | 'running' | 'success' | 'failed';

export interface TaskCommand {
  id: string;
  order: number;
  command: string;
  label?: string;
  timeout: number;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  commands: TaskCommand[];
  lastExecutionStatus?: TaskExecutionStatus;
  lastExecutionAt?: string;
  stopOnError: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskCommandDto {
  order: number;
  command: string;
  label?: string;
  timeout?: number;
}

export interface CreateTaskDto {
  name: string;
  description?: string;
  commands: CreateTaskCommandDto[];
  stopOnError?: boolean;
}

export interface UpdateTaskCommandDto {
  id?: string;
  order: number;
  command: string;
  label?: string;
  timeout?: number;
}

export interface UpdateTaskDto {
  name?: string;
  description?: string;
  commands?: UpdateTaskCommandDto[];
  stopOnError?: boolean;
}

export interface TaskStart {
  taskId: string;
  taskName: string;
  totalCommands: number;
  totalServers: number;
  stopOnError: boolean;
  timestamp: number;
}

export interface TaskComplete {
  taskId: string;
  taskName: string;
  success: boolean;
  totalCommands: number;
  completedCommands: number;
  failedCommands: number;
  timestamp: number;
}

export interface TaskCommandStart {
  taskId: string;
  taskName: string;
  commandId: string;
  commandOrder: number;
  command: string;
  label?: string;
  totalCommands: number;
  timestamp: number;
}

export interface TaskCommandOutput {
  taskId: string;
  commandId: string;
  commandOrder: number;
  output: CommandOutput;
}

export interface TaskCommandServerComplete {
  taskId: string;
  commandId: string;
  commandOrder: number;
  serverResult: ServerCompleteResult;
}

export interface TaskCommandComplete {
  taskId: string;
  commandId: string;
  commandOrder: number;
  command: string;
  success: boolean;
  totalServers: number;
  successServers: number;
  failedServers: number;
  timestamp: number;
}

export interface ServerCompleteResult {
  serverId: string;
  serverName: string;
  success: boolean;
  timestamp: number;
}

export interface TimelineItem {
  id: string;
  type: 'task-start' | 'task-complete' | 'command-start' | 'command-complete' | 'output';
  timestamp: number;
  taskId: string;
  taskName: string;
  commandOrder?: number;
  command?: string;
  label?: string;
  success?: boolean;
  output?: CommandOutput;
  extra?: any;
}
