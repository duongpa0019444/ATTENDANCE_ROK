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
    return this.prisma.$transaction(async (tx) => {
      // 1. Lấy danh sách ID của AttendanceLog thuộc về User này
      const attendanceLogs = await tx.attendanceLog.findMany({
        where: { user_id: id },
        select: { id: true }
      });
      const attendanceLogIds = attendanceLogs.map(log => log.id);

      if (attendanceLogIds.length > 0) {
        // 2. Xóa các bản ghi EscalationLog liên quan đến AttendanceLog
        await tx.escalationLog.deleteMany({
          where: {
            attendance_id: { in: attendanceLogIds }
          }
        });
      }

      // 3. Xóa các bản ghi AttendanceLog của User
      await tx.attendanceLog.deleteMany({
        where: { user_id: id }
      });

      // 4. Xóa các thông báo (Notification) của User
      await tx.notification.deleteMany({
        where: { user_id: id }
      });

      // 5. Cập nhật các bản ghi AuditLog để set actor_id thành null
      await tx.auditLog.updateMany({
        where: { actor_id: id },
        data: { actor_id: null }
      });

      // 6. Xóa các ca làm (ShiftAssignment) của User
      await tx.shiftAssignment.deleteMany({
        where: { user_id: id }
      });

      // 7. Cuối cùng, xóa User
      return tx.user.delete({
        where: { id }
      });
    });
  }
}
