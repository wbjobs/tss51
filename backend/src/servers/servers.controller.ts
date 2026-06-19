import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { ServersService } from './servers.service';
import { Server } from './server.entity';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';

@Controller('api/servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @Get()
  findAll(): Promise<Server[]> {
    return this.serversService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Server> {
    return this.serversService.findOne(id);
  }

  @Post()
  create(@Body() createServerDto: CreateServerDto): Promise<Server> {
    return this.serversService.create(createServerDto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateServerDto: UpdateServerDto,
  ): Promise<Server> {
    return this.serversService.update(id, updateServerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.serversService.remove(id);
  }
}
