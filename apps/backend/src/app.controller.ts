import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { Roles } from './auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('api/settings')
  async getSettings() {
    const lat = await this.prisma.getSetting(
      'OFFICE_LATITUDE',
      this.configService.get<string>('OFFICE_LATITUDE') || '21.028511'
    );
    const lng = await this.prisma.getSetting(
      'OFFICE_LONGITUDE',
      this.configService.get<string>('OFFICE_LONGITUDE') || '105.804817'
    );
    const radius = await this.prisma.getSetting(
      'OFFICE_RADIUS_METERS',
      this.configService.get<string>('OFFICE_RADIUS_METERS') || '100'
    );
    const reminderMins = await this.prisma.getSetting('REMINDER_MINUTES', '10');
    const prepMins = await this.prisma.getSetting('PREPARATION_MINUTES', '0');
    const unconfirmedWarningMins = await this.prisma.getSetting('UNCONFIRMED_WARNING_MINUTES', '5');
    const checkinGraceMins = await this.prisma.getSetting('CHECKIN_GRACE_MINUTES', '5');

    return {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      radiusMeters: parseFloat(radius),
      reminderMinutes: parseInt(reminderMins, 10),
      preparationMinutes: parseInt(prepMins, 10),
      unconfirmedWarningMinutes: parseInt(unconfirmedWarningMins, 10),
      checkinGraceMinutes: parseInt(checkinGraceMins, 10),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('api/settings')
  async updateSettings(
    @Body()
    body: {
      latitude: number;
      longitude: number;
      radiusMeters: number;
      reminderMinutes?: number;
      preparationMinutes?: number;
      unconfirmedWarningMinutes?: number;
      checkinGraceMinutes?: number;
    },
  ) {
    await this.prisma.setSetting('OFFICE_LATITUDE', body.latitude.toString());
    await this.prisma.setSetting('OFFICE_LONGITUDE', body.longitude.toString());
    await this.prisma.setSetting('OFFICE_RADIUS_METERS', body.radiusMeters.toString());

    if (body.reminderMinutes !== undefined) {
      await this.prisma.setSetting('REMINDER_MINUTES', body.reminderMinutes.toString());
    }
    if (body.preparationMinutes !== undefined) {
      await this.prisma.setSetting('PREPARATION_MINUTES', body.preparationMinutes.toString());
    }
    if (body.unconfirmedWarningMinutes !== undefined) {
      await this.prisma.setSetting('UNCONFIRMED_WARNING_MINUTES', body.unconfirmedWarningMinutes.toString());
    }
    if (body.checkinGraceMinutes !== undefined) {
      await this.prisma.setSetting('CHECKIN_GRACE_MINUTES', body.checkinGraceMinutes.toString());
    }

    return { success: true };
  }
}
