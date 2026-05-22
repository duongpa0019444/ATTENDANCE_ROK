import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        full_name: true,
        telegram_id: true,
        role: true,
        status: true,
      }
    });
  }

  async create(data: any) {
    const hashedPassword = await bcrypt.hash(data.password || '123456789', 10);
    return this.prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        full_name: data.full_name,
        telegram_id: data.telegram_id || null,
        role: data.role || 'STAFF',
      },
      select: {
        id: true,
        username: true,
        full_name: true
      }
    });
  }

  async updateTelegramId(id: string, telegramId: string) {
    return this.prisma.user.update({
      where: { id },
      data: { telegram_id: telegramId }
    });
  }

  async update(id: string, data: any) {
    const updateData: any = {
      username: data.username,
      full_name: data.full_name,
      role: data.role,
    };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, full_name: true, role: true }
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id }
    });
  }
}
