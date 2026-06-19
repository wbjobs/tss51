import { Injectable, Logger } from '@nestjs/common';
import { Task, TaskExecutionStatus } from './task.entity';
import { TaskCommand } from './task-command.entity';
import { TasksService } from './tasks.service';
import { SshService, CommandOutput, ServerCompleteResult } from '../ssh/ssh.service';

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

@Injectable()
export class TaskExecutionService {
  private readonly logger = new Logger(TaskExecutionService.name);
  private runningTasks: Set<string> = new Set();

  constructor(
    private tasksService: TasksService,
    private sshService: SshService,
  ) {}

  isTaskRunning(taskId: string): boolean {
    return this.runningTasks.has(taskId);
  }

  async executeTask(
    taskId: string,
    callbacks: {
      onTaskStart?: (event: TaskStart) => void;
      onTaskComplete?: (event: TaskComplete) => void;
      onCommandStart?: (event: TaskCommandStart) => void;
      onCommandOutput?: (event: TaskCommandOutput) => void;
      onCommandServerComplete?: (event: TaskCommandServerComplete) => void;
      onCommandComplete?: (event: TaskCommandComplete) => void;
    } = {},
  ): Promise<void> {
    if (this.isTaskRunning(taskId)) {
      throw new Error(`Task ${taskId} is already running`);
    }

    const task = await this.tasksService.findOne(taskId);
    if (!task.commands || task.commands.length === 0) {
      throw new Error('Task has no commands');
    }

    const connectedServers = this.sshService.getConnectedServers();
    if (connectedServers.length === 0) {
      throw new Error('No servers connected');
    }

    this.runningTasks.add(taskId);
    await this.tasksService.updateExecutionStatus(taskId, 'running');

    const sortedCommands = [...task.commands].sort((a, b) => a.order - b.order);
    const totalCommands = sortedCommands.length;
    const totalServers = connectedServers.length;
    let completedCommands = 0;
    let failedCommands = 0;
    let taskSuccess = true;

    callbacks.onTaskStart?.({
      taskId: task.id,
      taskName: task.name,
      totalCommands,
      totalServers,
      stopOnError: task.stopOnError,
      timestamp: Date.now(),
    });

    for (let i = 0; i < sortedCommands.length; i++) {
      const cmd = sortedCommands[i];

      const { success, successServers, failedServers } = await this.executeSingleCommand(
        task,
        cmd,
        i,
        totalCommands,
        connectedServers.length,
        callbacks,
      );

      completedCommands++;
      if (!success) {
        failedCommands++;
        taskSuccess = false;

        if (task.stopOnError) {
          break;
        }
      }
    }

    const finalStatus: TaskExecutionStatus = taskSuccess ? 'success' : 'failed';
    await this.tasksService.updateExecutionStatus(taskId, finalStatus);

    callbacks.onTaskComplete?.({
      taskId: task.id,
      taskName: task.name,
      success: taskSuccess,
      totalCommands,
      completedCommands,
      failedCommands,
      timestamp: Date.now(),
    });

    this.runningTasks.delete(taskId);
  }

  private async executeSingleCommand(
    task: Task,
    cmd: TaskCommand,
    commandOrder: number,
    totalCommands: number,
    totalServers: number,
    callbacks: {
      onCommandStart?: (event: TaskCommandStart) => void;
      onCommandOutput?: (event: TaskCommandOutput) => void;
      onCommandServerComplete?: (event: TaskCommandServerComplete) => void;
      onCommandComplete?: (event: TaskCommandComplete) => void;
    },
  ): Promise<{ success: boolean; successServers: number; failedServers: number }> {
    return new Promise((resolve) => {
      const serverCompleteResults: ServerCompleteResult[] = [];
      let successServers = 0;
      let failedServers = 0;

      callbacks.onCommandStart?.({
        taskId: task.id,
        taskName: task.name,
        commandId: cmd.id,
        commandOrder,
        command: cmd.command,
        label: cmd.label,
        totalCommands,
        timestamp: Date.now(),
      });

      const onOutput = (output: CommandOutput) => {
        callbacks.onCommandOutput?.({
          taskId: task.id,
          commandId: cmd.id,
          commandOrder,
          output,
        });
      };

      const onServerComplete = (result: ServerCompleteResult) => {
        serverCompleteResults.push(result);
        if (result.success) {
          successServers++;
        } else {
          failedServers++;
        }

        callbacks.onCommandServerComplete?.({
          taskId: task.id,
          commandId: cmd.id,
          commandOrder,
          serverResult: result,
        });

        if (serverCompleteResults.length === totalServers) {
          const allSuccess = failedServers === 0;

          callbacks.onCommandComplete?.({
            taskId: task.id,
            commandId: cmd.id,
            commandOrder,
            command: cmd.command,
            success: allSuccess,
            totalServers,
            successServers,
            failedServers,
            timestamp: Date.now(),
          });

          resolve({
            success: allSuccess,
            successServers,
            failedServers,
          });
        }
      };

      this.sshService.executeCommandOnAll(cmd.command, onOutput, onServerComplete);
    });
  }
}
