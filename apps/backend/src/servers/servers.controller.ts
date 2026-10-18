import { Controller, Get, Post, Body, Put, Delete, Param, UseGuards, Query, Request } from '@nestjs/common';
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
  create(@Request() req: any, @Body() data: { name: string; base_salary?: number }) {
    return this.serversService.create(data, req.user?.userId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Put(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { name?: string; status?: string; base_salary?: number; week_start_date?: string }
  ) {
    return this.serversService.update(id, data, req.user?.userId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.serversService.remove(id, req.user?.userId);
  }
}
