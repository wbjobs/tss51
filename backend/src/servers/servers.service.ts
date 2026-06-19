import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from './server.entity';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';

@Injectable()
export class ServersService {
  constructor(
    @InjectRepository(Server)
    private serversRepository: Repository<Server>,
  ) {}

  async findAll(): Promise<Server[]> {
    return this.serversRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Server> {
    const server = await this.serversRepository.findOne({ where: { id } });
    if (!server) {
      throw new NotFoundException(`Server with ID ${id} not found`);
    }
    return server;
  }

  async create(createServerDto: CreateServerDto): Promise<Server> {
    const existing = await this.serversRepository.findOne({
      where: { name: createServerDto.name },
    });
    if (existing) {
      throw new ConflictException(`Server name "${createServerDto.name}" already exists`);
    }

    const server = this.serversRepository.create({
      ...createServerDto,
      port: createServerDto.port || 22,
    });
    
    return this.serversRepository.save(server);
  }

  async update(id: string, updateServerDto: UpdateServerDto): Promise<Server> {
    const server = await this.findOne(id);
    
    if (updateServerDto.name && updateServerDto.name !== server.name) {
      const existing = await this.serversRepository.findOne({
        where: { name: updateServerDto.name },
      });
      if (existing) {
        throw new ConflictException(`Server name "${updateServerDto.name}" already exists`);
      }
    }

    Object.assign(server, updateServerDto);
    return this.serversRepository.save(server);
  }

  async remove(id: string): Promise<void> {
    const server = await this.findOne(id);
    await this.serversRepository.remove(server);
  }

  async updateConnectionStatus(id: string, connected: boolean, error?: string): Promise<void> {
    await this.serversRepository.update(id, {
      connected,
      lastError: error || null,
    });
  }

  async findConnectedServers(): Promise<Server[]> {
    return this.serversRepository.find({
      where: { connected: true },
      order: { name: 'ASC' },
    });
  }
}
