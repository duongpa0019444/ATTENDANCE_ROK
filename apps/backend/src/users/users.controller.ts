import { Controller, Get, Post, Body, Put, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() data: any) {
    return this.usersService.create(data);
  }

  @Put(':id/telegram')
  updateTelegramId(@Param('id') id: string, @Body('telegram_id') telegramId: string) {
    return this.usersService.updateTelegramId(id, telegramId);
  }
}
