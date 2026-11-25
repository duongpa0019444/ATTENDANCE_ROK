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

      const targetDateTimeStr = `${targetDateStr}T${startTime}:00`;

      const lockedPeriods = await this.lockedPeriod.findMany();

      for (const locked of lockedPeriods) {
        const startStr = this.formatDateOnly(locked.start_date);
        const endStr = this.formatDateOnly(locked.end_date);

        // Resolve dynamic start_time / end_time if configured in CustomWeekPeriod or WeekCycleRule
        let startBoundTime = '07:00';
        let endBoundTime = '06:59';
        const custom = await this.customWeekPeriod.findFirst({
          where: {
            start_date: { lte: locked.start_date },
            end_date: { gte: locked.start_date },
          },
        });
        if (custom) {
          startBoundTime = custom.start_time || '07:00';
          endBoundTime = custom.end_time || '06:59';
        } else {
          const rule = await this.weekCycleRule.findFirst({
            where: { effective_date: { lte: locked.start_date } },
            orderBy: { effective_date: 'desc' },
          });
          if (rule) {
            startBoundTime = rule.start_time || '07:00';
            endBoundTime = rule.end_time || '06:59';
          }
        }

        const startBoundary = `${startStr}T${startBoundTime}:00`;
        const endBoundary = `${endStr}T${endBoundTime}:59`;

        if (targetDateTimeStr >= startBoundary && targetDateTimeStr <= endBoundary) {
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
      const getUtcDate = (d: Date | string) => {
        const dateObj = new Date(d);
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(dateObj);
        const year = Number(parts.find((part) => part.type === 'year')?.value);
        const month = Number(parts.find((part) => part.type === 'month')?.value);
        const day = Number(parts.find((part) => part.type === 'day')?.value);
        return new Date(Date.UTC(year, month - 1, day));
      };

      const startDate = getUtcDate(start);
      const endDate = getUtcDate(end);
      endDate.setUTCHours(23, 59, 59, 999);

      const locked = await this.lockedPeriod.findFirst({
        where: {
          start_date: { lt: endDate },
          end_date: { gt: startDate },
        },
      });
      return !!locked;
    } catch {
      return false;
    }
  }
}

