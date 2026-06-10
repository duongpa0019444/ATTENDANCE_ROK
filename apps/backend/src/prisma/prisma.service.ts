import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    await this.seedAdmin();
  }

  private async seedAdmin() {
    try {
      const adminCount = await this.user.count({
        where: { role: 'ADMIN' },
      });
      if (adminCount === 0) {
        const hashedPassword = await bcrypt.hash('admin', 10);
        await this.user.create({
          data: {
            username: 'admin',
            password: hashedPassword,
            full_name: 'System Admin',
            role: 'ADMIN',
          },
        });
        console.log('✅ Seeded default admin user (username: admin, password: admin)');
      }
    } catch (e) {
      console.error('Failed to seed admin user:', e);
    }
  }

  async getSetting(key: string, defaultValue: string): Promise<string> {
    try {
      const setting = await this.setting.findUnique({
        where: { key },
      });
      return setting ? setting.value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  formatDateOnly(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }

  getWeekStartDateStr(date: Date | string): string {
    const d = new Date(date);
    const day = d.getDay();
    // get Monday of the week
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return this.formatDateOnly(monday);
  }

  async getShiftDayStartTimeForDate(date: Date | string): Promise<string> {
    const mondayStr = this.getWeekStartDateStr(date);
    return this.getSetting(`WEEK_START_TIME_${mondayStr}`, '07:00');
  }

  async isDateLocked(date: Date | string | null | undefined, shiftIdOrStartTime?: string): Promise<boolean> {
    if (!date) return false;
    try {
      const targetDate = new Date(date);
      const targetDateStr = this.formatDateOnly(targetDate);

      let startTime = '00:00';
      if (shiftIdOrStartTime) {
        if (shiftIdOrStartTime.includes(':')) {
          startTime = shiftIdOrStartTime;
        } else {
          const shift = await this.shift.findUnique({
            where: { id: shiftIdOrStartTime },
            select: { start_time: true },
          });
          if (shift) {
            startTime = shift.start_time;
          }
        }
      }

      const targetDateTime = new Date(`${targetDateStr}T${startTime}:00`);

      const shiftDayStartTime = await this.getShiftDayStartTimeForDate(targetDate);
      const lockedPeriods = await this.lockedPeriod.findMany();

      for (const locked of lockedPeriods) {
        const startStr = this.formatDateOnly(locked.start_date);
        const endStr = this.formatDateOnly(locked.end_date);

        const startBoundaryDate = new Date(`${startStr}T${shiftDayStartTime}:00`);
        const endBoundaryDate = new Date(`${endStr}T${shiftDayStartTime}:00`);
        endBoundaryDate.setSeconds(endBoundaryDate.getSeconds() - 1);

        if (targetDateTime >= startBoundaryDate && targetDateTime <= endBoundaryDate) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  async isPeriodOverlappingLocked(start: Date | string, end: Date | string): Promise<boolean> {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const locked = await this.lockedPeriod.findFirst({
        where: {
          start_date: { lte: endDate },
          end_date: { gte: startDate },
        },
      });
      return !!locked;
    } catch {
      return false;
    }
  }
}

