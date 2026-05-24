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

  async isDateLocked(date: Date | string | null | undefined): Promise<boolean> {
    if (!date) return false;
    try {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      const locked = await this.lockedPeriod.findFirst({
        where: {
          start_date: { lte: targetDate },
          end_date: { gte: targetDate },
        },
      });
      return !!locked;
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

