import { Controller, Get, Post, Body, Put, Delete, Param, UseGuards, Query } from '@nestjs/common';
import { ServersService } from './servers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @Get()
  findAll(@Query('week_start_date') weekStartDate?: string) {
    return this.serversService.findAll(weekStartDate);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  create(@Body() data: { name: string; base_salary?: number }) {
    return this.serversService.create(data);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; status?: string; base_salary?: number; week_start_date?: string }
  ) {
    return this.serversService.update(id, data);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serversService.remove(id);
  }
}
