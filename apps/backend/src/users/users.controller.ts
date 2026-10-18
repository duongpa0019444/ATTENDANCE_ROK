import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Request() req: any, @Body() data: any) {
    return this.usersService.create(data, req.user?.userId);
  }

  @Put(':id/telegram')
  updateTelegramId(@Request() req: any, @Param('id') id: string, @Body('telegram_id') telegramId: string) {
    return this.usersService.updateTelegramId(id, telegramId, req.user?.userId);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.usersService.update(id, data, req.user?.userId);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.usersService.remove(id, req.user?.userId);
  }
}
