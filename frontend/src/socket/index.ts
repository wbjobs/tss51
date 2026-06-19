import { io, Socket } from 'socket.io-client';
import type { Server, CommandOutput } from '../types';

class TerminalSocket {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io('http://localhost:3001/terminal', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.getServers();
      this.getTasks();
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getServers(): void {
    if (this.socket?.connected) {
      this.socket.emit('get-servers');
    }
  }

  executeCommand(command: string): void {
    if (this.socket?.connected) {
      this.socket.emit('execute', { command });
    }
  }

  connectServer(serverId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('connect-server', { serverId });
    }
  }

  disconnectServer(serverId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('disconnect-server', { serverId });
    }
  }

  connectAll(): void {
    if (this.socket?.connected) {
      this.socket.emit('connect-all');
    }
  }

  disconnectAll(): void {
    if (this.socket?.connected) {
      this.socket.emit('disconnect-all');
    }
  }

  getTasks(): void {
    if (this.socket?.connected) {
      this.socket.emit('get-tasks');
    }
  }

  executeTask(taskId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('execute-task', { taskId });
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const terminalSocket = new TerminalSocket();
