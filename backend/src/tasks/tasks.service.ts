import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskExecutionStatus } from './task.entity';
import { TaskCommand } from './task-command.entity';
import { CreateTaskDto, CreateTaskCommandDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(TaskCommand)
    private taskCommandsRepository: Repository<TaskCommand>,
  ) {}

  async findAll(): Promise<Task[]> {
    const tasks = await this.tasksRepository.find({
      order: { createdAt: 'DESC' },
    });
    return tasks.map((task) => this.sortTaskCommands(task));
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return this.sortTaskCommands(task);
  }

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const existing = await this.tasksRepository.findOne({
      where: { name: createTaskDto.name },
    });
    if (existing) {
      throw new ConflictException(`Task name "${createTaskDto.name}" already exists`);
    }

    const commands = this.normalizeCommands(createTaskDto.commands);

    const task = this.tasksRepository.create({
      name: createTaskDto.name,
      description: createTaskDto.description,
      stopOnError: createTaskDto.stopOnError ?? false,
      commands,
    });

    const saved = await this.tasksRepository.save(task);
    return this.findOne(saved.id);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);

    if (updateTaskDto.name && updateTaskDto.name !== task.name) {
      const existing = await this.tasksRepository.findOne({
        where: { name: updateTaskDto.name },
      });
      if (existing) {
        throw new ConflictException(`Task name "${updateTaskDto.name}" already exists`);
      }
    }

    if (updateTaskDto.commands !== undefined) {
      await this.taskCommandsRepository.delete({ taskId: id });

      const commands = this.normalizeCommands(updateTaskDto.commands);
      await this.taskCommandsRepository.save(
        commands.map((cmd) => ({
          ...cmd,
          taskId: id,
        })),
      );
    }

    Object.assign(task, {
      name: updateTaskDto.name,
      description: updateTaskDto.description,
      stopOnError: updateTaskDto.stopOnError ?? task.stopOnError,
    });

    await this.tasksRepository.save(task);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    await this.tasksRepository.remove(task);
  }

  async updateExecutionStatus(
    id: string,
    status: TaskExecutionStatus,
  ): Promise<void> {
    await this.tasksRepository.update(id, {
      lastExecutionStatus: status,
      lastExecutionAt: new Date(),
    });
  }

  private sortTaskCommands(task: Task): Task {
    if (task.commands && task.commands.length > 0) {
      task.commands.sort((a, b) => a.order - b.order);
    }
    return task;
  }

  private normalizeCommands(
    commands: (CreateTaskCommandDto | UpdateTaskDto['commands'][number])[],
  ): Omit<TaskCommand, 'id' | 'task' | 'taskId'>[] {
    const sorted = [...commands].sort((a, b) => a.order - b.order);
    return sorted.map((cmd, index) => ({
      order: index,
      command: cmd.command,
      label: cmd.label || null,
      timeout: cmd.timeout || 0,
    }));
  }
}
