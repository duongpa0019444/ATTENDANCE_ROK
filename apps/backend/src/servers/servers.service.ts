import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class ServersService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async findAll(weekStartDate?: string) {
    const servers = await this.prisma.server.findMany({
      orderBy: { name: 'asc' },
    });

    if (weekStartDate) {
      const parsedDate = new Date(`${weekStartDate}T00:00:00Z`);
      for (const server of servers) {
        const history = await this.prisma.serverSalaryHistory.findFirst({
          where: {
            server_id: server.id,
            start_date: parsedDate,
          },
        });
        if (history) {
          server.base_salary = history.base_salary;
        } else {
          server.base_salary = 0;
        }
      }
    }

    return servers;
  }

  async create(data: { name: string; base_salary?: number }, actorId?: string) {
    const server = await this.prisma.server.create({
      data: {
        name: data.name,
        base_salary: data.base_salary !== undefined ? Number(data.base_salary) : 0,
      },
    });

    await this.auditLogsService.log({
      actorId,
      page: 'SERVERS',
      action: 'CREATE',
      entityType: 'Server',
      entityId: server.id,
      summary: `Thêm server [SV ${server.name}]`,
      metadata: {
        serverName: server.name,
        created: {
          'Tên server': `SV ${server.name}`,
          'Lương cơ bản': server.base_salary ? `${Number(server.base_salary).toLocaleString('vi-VN')}đ` : 'Mặc định (0đ)',
        }
      }
    });

    return server;
  }

  async update(id: string, data: { name?: string; status?: string; base_salary?: number; week_start_date?: string }, actorId?: string) {
    const oldServer = await this.prisma.server.findUnique({ where: { id } });

    if (data.week_start_date) {
      const start = new Date(`${data.week_start_date}T00:00:00Z`);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      if (await this.prisma.isPeriodOverlappingLocked(start, end)) {
        throw new BadRequestException('Khoảng thời gian này đã được chốt bảng lương. Không thể cập nhật cấu hình thù lao.');
      }
    }

    const server = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.server.update({
        where: { id },
        data: {
          name: data.name,
          status: data.status,
          base_salary: data.base_salary !== undefined ? Number(data.base_salary) : undefined,
        },
      });

      if (data.week_start_date && data.base_salary !== undefined) {
        const parsedDate = new Date(`${data.week_start_date}T00:00:00Z`);
        const baseSalary = Number(data.base_salary);

        const existing = await tx.serverSalaryHistory.findUnique({
          where: {
            server_id_start_date: {
              server_id: id,
              start_date: parsedDate,
            },
          },
        });

        if (existing) {
          await tx.serverSalaryHistory.update({
            where: { id: existing.id },
            data: { base_salary: baseSalary },
          });
        } else {
          await tx.serverSalaryHistory.create({
            data: {
              server_id: id,
              start_date: parsedDate,
              base_salary: baseSalary,
            },
          });
        }
      }

      return updated;
    });

    if (oldServer) {
      const changes: Array<{ field: string; label: string; old: any; new: any }> = [];
      if (data.name && data.name !== oldServer.name) {
        changes.push({ field: 'name', label: 'Tên server', old: `SV ${oldServer.name}`, new: `SV ${data.name}` });
      }
      if (data.base_salary !== undefined && Number(data.base_salary) !== Number(oldServer.base_salary)) {
        changes.push({
          field: 'base_salary',
          label: 'Lương cơ bản',
          old: `${Number(oldServer.base_salary || 0).toLocaleString('vi-VN')}đ`,
          new: `${Number(data.base_salary || 0).toLocaleString('vi-VN')}đ`
        });
      }
      if (data.status && data.status !== oldServer.status) {
        changes.push({ field: 'status', label: 'Trạng thái', old: oldServer.status, new: data.status });
      }

      if (changes.length > 0) {
        const summaries = changes.map(c => `${c.label}: "${c.old}" → "${c.new}"`).join(', ');
        await this.auditLogsService.log({
          actorId,
          page: 'SERVERS',
          action: 'UPDATE',
          entityType: 'Server',
          entityId: server.id,
          summary: `Cập nhật server [SV ${server.name}]: ${summaries}`,
          metadata: {
            serverName: server.name,
            changes
          }
        });
      }
    }

    return server;
  }

  async remove(id: string, actorId?: string) {
    const server = await this.prisma.server.findUnique({
      where: { id },
      select: { name: true }
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Lấy danh sách ID các Ca làm (Shift) của Server này
      const shifts = await tx.shift.findMany({
        where: { server_id: id },
        select: { id: true }
      });
      const shiftIds = shifts.map(s => s.id);

      if (shiftIds.length > 0) {
        // 2. Lấy danh sách ID phân công ca làm (ShiftAssignment) liên quan
        const assignments = await tx.shiftAssignment.findMany({
          where: { shift_id: { in: shiftIds } },
          select: { id: true }
        });
        const assignmentIds = assignments.map(a => a.id);

        if (assignmentIds.length > 0) {
          // 3. Lấy danh sách ID lịch sử điểm danh (AttendanceLog) liên quan
          const attendanceLogs = await tx.attendanceLog.findMany({
            where: { shift_assignment_id: { in: assignmentIds } },
            select: { id: true }
          });
          const attendanceLogIds = attendanceLogs.map(log => log.id);

          if (attendanceLogIds.length > 0) {
            // 4. Xóa EscalationLog của các lịch sử điểm danh này
            await tx.escalationLog.deleteMany({
              where: { attendance_id: { in: attendanceLogIds } }
            });

            // 5. Xóa các AttendanceLog liên quan
            await tx.attendanceLog.deleteMany({
              where: { id: { in: attendanceLogIds } }
            });
          }

          // 6. Xóa các phân công ca làm (ShiftAssignment)
          await tx.shiftAssignment.deleteMany({
            where: { id: { in: assignmentIds } }
          });
        }

        // 7. Xóa các Ca làm (Shift) của Server
        await tx.shift.deleteMany({
          where: { id: { in: shiftIds } }
        });
      }

      // 8. Cuối cùng, xóa Server
      return tx.server.delete({
        where: { id },
      });
    });

    await this.auditLogsService.log({
      actorId,
      page: 'SERVERS',
      action: 'DELETE',
      entityType: 'Server',
      entityId: id,
      summary: `Xóa server [SV ${server?.name || id}]`,
      metadata: {
        serverName: server?.name || 'N/A'
      }
    });

    return result;
  }
}
