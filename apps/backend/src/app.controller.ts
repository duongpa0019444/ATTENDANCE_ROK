import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { Roles } from './auth/roles.decorator';
import { Role } from '@prisma/client';
import { AuditLogsService } from './audit-logs/audit-logs.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
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
    @Request() req: any,
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
    const changes: Array<{ field: string; label: string; old: any; new: any }> = [];
    const currentLat = await this.prisma.getSetting('OFFICE_LATITUDE', '21.028511');
    const currentLng = await this.prisma.getSetting('OFFICE_LONGITUDE', '105.804817');
    const currentRadius = await this.prisma.getSetting('OFFICE_RADIUS_METERS', '100');
    const currentReminder = await this.prisma.getSetting('REMINDER_MINUTES', '10');
    const currentPrep = await this.prisma.getSetting('PREPARATION_MINUTES', '0');
    const currentWarning = await this.prisma.getSetting('UNCONFIRMED_WARNING_MINUTES', '5');
    const currentGrace = await this.prisma.getSetting('CHECKIN_GRACE_MINUTES', '5');

    if (body.latitude !== undefined) {
      if (body.latitude.toString() !== currentLat) {
        changes.push({ field: 'latitude', label: 'Vĩ độ (GPS Lat)', old: currentLat, new: body.latitude.toString() });
      }
      await this.prisma.setSetting('OFFICE_LATITUDE', body.latitude.toString());
    }
    if (body.longitude !== undefined) {
      if (body.longitude.toString() !== currentLng) {
        changes.push({ field: 'longitude', label: 'Kinh độ (GPS Lng)', old: currentLng, new: body.longitude.toString() });
      }
      await this.prisma.setSetting('OFFICE_LONGITUDE', body.longitude.toString());
    }
    if (body.radiusMeters !== undefined) {
      if (body.radiusMeters.toString() !== currentRadius) {
        changes.push({ field: 'radiusMeters', label: 'Bán kính văn phòng', old: currentRadius + 'm', new: body.radiusMeters + 'm' });
      }
      await this.prisma.setSetting('OFFICE_RADIUS_METERS', body.radiusMeters.toString());
    }

    if (body.reminderMinutes !== undefined) {
      if (body.reminderMinutes.toString() !== currentReminder) {
        changes.push({ field: 'reminderMinutes', label: 'Nhắc ca trước', old: currentReminder + ' phút', new: body.reminderMinutes + ' phút' });
      }
      await this.prisma.setSetting('REMINDER_MINUTES', body.reminderMinutes.toString());
    }
    if (body.preparationMinutes !== undefined) {
      if (body.preparationMinutes.toString() !== currentPrep) {
        changes.push({ field: 'preparationMinutes', label: 'Điểm danh chuẩn bị', old: currentPrep + ' phút', new: body.preparationMinutes + ' phút' });
      }
      await this.prisma.setSetting('PREPARATION_MINUTES', body.preparationMinutes.toString());
    }
    if (body.unconfirmedWarningMinutes !== undefined) {
      if (body.unconfirmedWarningMinutes.toString() !== currentWarning) {
        changes.push({ field: 'unconfirmedWarningMinutes', label: 'Cảnh báo chưa xác nhận', old: currentWarning + ' phút', new: body.unconfirmedWarningMinutes + ' phút' });
      }
      await this.prisma.setSetting('UNCONFIRMED_WARNING_MINUTES', body.unconfirmedWarningMinutes.toString());
    }
    if (body.checkinGraceMinutes !== undefined) {
      if (body.checkinGraceMinutes.toString() !== currentGrace) {
        changes.push({ field: 'checkinGraceMinutes', label: 'Ân hạn điểm danh muộn', old: currentGrace + ' phút', new: body.checkinGraceMinutes + ' phút' });
      }
      await this.prisma.setSetting('CHECKIN_GRACE_MINUTES', body.checkinGraceMinutes.toString());
    }

    if (changes.length > 0) {
      const changeSummaries = changes.map(c => `${c.label}: "${c.old}" → "${c.new}"`).join(', ');
      await this.auditLogsService.log({
        actorId: req.user?.userId,
        page: 'SETTINGS',
        action: 'UPDATE',
        entityType: 'SystemSetting',
        summary: `Cập nhật cấu hình: ${changeSummaries}`,
        metadata: { changes },
      });
    }

    return { success: true };
  }
}
