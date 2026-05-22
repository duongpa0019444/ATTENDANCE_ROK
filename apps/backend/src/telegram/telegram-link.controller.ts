import { Controller, Post, Body, Get, Param, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { TelegramLinkService } from './telegram-link.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('telegram')
export class TelegramLinkController {
  constructor(private readonly telegramLinkService: TelegramLinkService) {}

  /**
   * POST /telegram/create-link
   * Body: { username: string }
   * Returns: { deepLink, token, expiresAt }
   */
  @Post('create-link')
  async createLink(@Body('username') username: string) {
    if (!username) {
      throw new HttpException('Username is required', HttpStatus.BAD_REQUEST);
    }
    return this.telegramLinkService.createLink(username);
  }

  /**
   * GET /telegram/link-status/:token
   * Check if a link token has been used (i.e. user completed the Telegram flow)
   */
  @Get('link-status/:token')
  async getLinkStatus(@Param('token') token: string) {
    return this.telegramLinkService.getLinkStatus(token);
  }
}
