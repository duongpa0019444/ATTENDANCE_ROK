import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) { }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        full_name: true,
        telegram_id: true,
        role: true,
        status: true,
        receive_shift_alert: true,
        created_at: true,
      },
      orderBy: [
        { role: 'asc' },
        { created_at: 'asc' },
      ],
    });
  }

  async create(data: any, actorId?: string) {
    const hashedPassword = await bcrypt.hash(data.password || '123456789', 10);
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        full_name: data.full_name,
        telegram_id: data.telegram_id || null,
        role: data.role || 'STAFF',
        receive_shift_alert: data.receive_shift_alert !== undefined ? Boolean(data.receive_shift_alert) : false,
      },
      select: {
        id: true,
        username: true,
        full_name: true,
        role: true,
        telegram_id: true,
        receive_shift_alert: true,
      }
    });

    await this.auditLogsService.log({
      actorId,
      page: 'USERS',
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      summary: `Tạo tài khoản nông dân [${user.full_name}] (${user.username}) - Vai trò: ${user.role}`,
      metadata: {
        created: {
          'Họ và tên': user.full_name,
          'Tên đăng nhập': user.username,
          'Vai trò': user.role,
          'Telegram ID': user.telegram_id || 'Chưa liên kết',
          'Nhận thông báo ca': user.receive_shift_alert ? 'Bật' : 'Tắt',
        }
      },
    });

    return user;
  }

  async updateTelegramId(id: string, telegramId: string, actorId?: string) {
    const oldUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, full_name: true, telegram_id: true }
    });

    if (!oldUser) return null;

    const newTg = telegramId || null;
    const oldTg = oldUser.telegram_id || null;
    if (newTg === oldTg) {
      return oldUser;
    }

    if (newTg) {
      const duplicate = await this.prisma.user.findFirst({
        where: { telegram_id: newTg, id: { not: id } }
      });
      if (duplicate) {
        throw new BadRequestException(`Telegram ID "${newTg}" đã được liên kết với nông dân [${duplicate.full_name}] (${duplicate.username})`);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { telegram_id: newTg }
    });

    await this.auditLogsService.log({
      actorId,
      page: 'USERS',
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      summary: `Cập nhật Telegram ID cho [${updated.full_name}]: "${oldTg || 'Chưa liên kết'}" → "${newTg || 'Chưa liên kết'}"`,
      metadata: {
        changes: [
          { field: 'telegram_id', label: 'Telegram ID', old: oldTg || 'Chưa liên kết', new: newTg || 'Chưa liên kết' }
        ]
      },
    });

    return updated;
  }

  async update(id: string, data: any, actorId?: string) {
    const oldUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, full_name: true, role: true, telegram_id: true, receive_shift_alert: true }
    });

    if (!oldUser) {
      throw new Error('User không tồn tại');
    }

    if (data.telegram_id) {
      const duplicate = await this.prisma.user.findFirst({
        where: { telegram_id: data.telegram_id, id: { not: id } }
      });
      if (duplicate) {
        throw new BadRequestException(`Telegram ID "${data.telegram_id}" đã được liên kết với nông dân [${duplicate.full_name}] (${duplicate.username})`);
      }
    }

    const updateData: any = {};
    if (data.username !== undefined) updateData.username = data.username;
    if (data.full_name !== undefined) updateData.full_name = data.full_name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.telegram_id !== undefined) updateData.telegram_id = data.telegram_id || null;
    if (data.receive_shift_alert !== undefined) updateData.receive_shift_alert = Boolean(data.receive_shift_alert);

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, full_name: true, role: true, telegram_id: true, receive_shift_alert: true }
    });

    const changes: Array<{ field: string; label: string; old: any; new: any }> = [];
    if (updateData.full_name !== undefined && updateData.full_name !== oldUser.full_name) {
      changes.push({ field: 'full_name', label: 'Họ và tên', old: oldUser.full_name, new: updateData.full_name });
    }
    if (updateData.username !== undefined && updateData.username !== oldUser.username) {
      changes.push({ field: 'username', label: 'Tên đăng nhập', old: oldUser.username, new: updateData.username });
    }
    if (updateData.role !== undefined && updateData.role !== oldUser.role) {
      changes.push({ field: 'role', label: 'Vai trò', old: oldUser.role, new: updateData.role });
    }
    if (data.telegram_id !== undefined && (data.telegram_id || null) !== (oldUser.telegram_id || null)) {
      changes.push({
        field: 'telegram_id',
        label: 'Telegram ID',
        old: oldUser.telegram_id || 'Chưa liên kết',
        new: data.telegram_id || 'Chưa liên kết'
      });
    }
    if (data.password) {
      changes.push({ field: 'password', label: 'Mật khẩu', old: '••••••', new: '•••••• (Đã đổi)' });
    }
    if (data.receive_shift_alert !== undefined && Boolean(data.receive_shift_alert) !== oldUser.receive_shift_alert) {
      changes.push({
        field: 'receive_shift_alert',
        label: 'Nhận thông báo ca',
        old: oldUser.receive_shift_alert ? 'Bật' : 'Tắt',
        new: Boolean(data.receive_shift_alert) ? 'Bật' : 'Tắt',
      });
    }

    if (changes.length > 0) {
      const changeSummaries = changes.map(c => `${c.label}: "${c.old ?? 'Trống'}" → "${c.new ?? 'Trống'}"`).join(', ');
      await this.auditLogsService.log({
        actorId,
        page: 'USERS',
        action: 'UPDATE',
        entityType: 'User',
        entityId: updated.id,
        summary: `Cập nhật thông tin [${updated.full_name}]: ${changeSummaries}`,
        metadata: {
          changes,
        },
      });
    }

    return updated;
  }

  async remove(id: string, actorId?: string) {
    const userToDelete = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, full_name: true },
    });

    const res = await this.prisma.$transaction(async (tx) => {
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

    await this.auditLogsService.log({
      actorId,
      page: 'USERS',
      action: 'DELETE',
      entityType: 'User',
      entityId: id,
      summary: `Xóa tài khoản nông dân [${userToDelete?.full_name || id}] (${userToDelete?.username || ''})`,
      metadata: { deletedUser: userToDelete },
    });

    return res;
  }
}
