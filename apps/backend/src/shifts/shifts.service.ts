import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImportExcelDto } from './import-excel.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class ShiftsService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async findAllShifts(weekStartDateStr?: string) {
    const where: any = {};
    if (weekStartDateStr) {
      where.week_start_date = new Date(weekStartDateStr);
    }
    return this.prisma.shift.findMany({
      where,
      include: { server: true },
      orderBy: { start_time: 'asc' }
    });
  }

  async createShift(data: any, actorId?: string) {
    let serverId = data.server_id;

    if (data.server_ids && Array.isArray(data.server_ids) && data.server_ids.length > 0) {
      if (data.server_ids.length === 1) {
        serverId = data.server_ids[0];
      } else {
        const dbServers = await this.prisma.server.findMany({
          where: { id: { in: data.server_ids } },
          select: { name: true }
        });
        
        const combinedName = dbServers
          .map(s => s.name)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .join('+');

        let compositeServer = await this.prisma.server.findUnique({
          where: { name: combinedName }
        });

        if (!compositeServer) {
          compositeServer = await this.prisma.server.create({
            data: { name: combinedName }
          });
        }
        
        serverId = compositeServer.id;
      }
    }

    const created = await this.prisma.shift.create({
      data: {
        name: data.name,
        server_id: serverId,
        start_time: data.start_time,
        end_time: data.end_time,
        grace_minutes: data.grace_minutes ? parseInt(data.grace_minutes) : 5,
        base_salary: data.base_salary !== undefined && data.base_salary !== null ? Number(data.base_salary) : null,
        bonus_salary: data.bonus_salary !== undefined && data.bonus_salary !== null ? Number(data.bonus_salary) : 0,
        bonus_days: data.bonus_days !== undefined ? data.bonus_days : null,
        night_bonus_22_24: data.night_bonus_22_24 !== undefined && data.night_bonus_22_24 !== null && data.night_bonus_22_24 !== '' ? Number(data.night_bonus_22_24) : null,
        night_bonus_0_3: data.night_bonus_0_3 !== undefined && data.night_bonus_0_3 !== null && data.night_bonus_0_3 !== '' ? Number(data.night_bonus_0_3) : null,
        night_bonus_3_7: data.night_bonus_3_7 !== undefined && data.night_bonus_3_7 !== null && data.night_bonus_3_7 !== '' ? Number(data.night_bonus_3_7) : null,
        weekend_bonus: data.weekend_bonus !== undefined && data.weekend_bonus !== null && data.weekend_bonus !== '' ? Number(data.weekend_bonus) : null,
        week_start_date: data.week_start_date ? new Date(data.week_start_date) : null,
      }
    });

    let serverName = 'N/A';
    if (serverId) {
      const srv = await this.prisma.server.findUnique({ where: { id: serverId }, select: { name: true } });
      if (srv) serverName = srv.name;
    }

    const shiftLabel = created.name || created.start_time;
    const timeRange = created.start_time + (created.end_time ? ` - ${created.end_time}` : '');

    await this.auditLogsService.log({
      actorId,
      page: 'SHIFT_MANAGEMENT',
      action: 'CREATE',
      entityType: 'Shift',
      entityId: created.id,
      summary: `Tạo ca làm việc [${shiftLabel}] SV ${serverName} (${timeRange})`,
      metadata: {
        serverName,
        shiftName: shiftLabel,
        startTime: created.start_time,
        created: {
          'Tên ca': shiftLabel,
          'Server': `SV ${serverName}`,
          'Giờ làm': timeRange,
          ...(created.base_salary ? { 'Lương cơ bản': `${Number(created.base_salary).toLocaleString('vi-VN')}đ` } : {}),
        }
      },
    });

    return created;
  }

  async assignShift(data: any, actorId?: string) {
    // Support both single work_date and array work_dates
    const dates: string[] = data.work_dates
      ? data.work_dates
      : [data.work_date];

    const results = [];

    for (const dateStr of dates) {
      const workDate = new Date(dateStr);
      if (await this.prisma.isDateLocked(workDate, data.shift_id)) {
        throw new BadRequestException('Ngày phân ca này đã nằm trong giai đoạn chốt bảng lương. Không thể phân ca.');
      }

      // Create shift assignment
      const assignment = await this.prisma.shiftAssignment.create({
        data: {
          user_id: data.user_id,
          shift_id: data.shift_id,
          work_date: workDate,
          status: 'SCHEDULED',
        },
        include: {
          user: true,
          shift: {
            include: { server: true }
          },
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPastDate = workDate < today;

      // Auto create AttendanceLog with READY status if in the past, otherwise PENDING
      await this.prisma.attendanceLog.create({
        data: {
          user_id: data.user_id,
          shift_assignment_id: assignment.id,
          status: isPastDate ? 'READY' : 'PENDING',
          confirm_at: isPastDate ? new Date() : null,
        }
      });

      results.push(assignment);
    }

    if (results.length > 0) {
      const first = results[0];
      const shift = first.shift;
      const user = first.user;
      const shiftInfo = `${shift?.name ? `${shift.name} ` : ''}(${shift?.start_time || ''}) SV ${shift?.server?.name || 'N/A'}`;
      const userName = user?.full_name || user?.username || 'Nhân sự';
      const formattedDates = dates.map(d => {
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
      }).join(', ');

      await this.auditLogsService.log({
        actorId,
        page: 'SHIFTS',
        action: 'CREATE',
        entityType: 'ShiftAssignment',
        entityId: data.shift_id,
        summary: `Phân công [${userName}] vào ca ${shiftInfo} ngày ${formattedDates}`,
        metadata: {
          serverName: shift?.server?.name || 'N/A',
          shiftName: shift?.name || 'Ca làm',
          startTime: shift?.start_time,
          workDate: formattedDates,
          changes: [
            {
              field: 'assignees',
              label: 'Nhân sự trực ca',
              old: 'Trống',
              new: userName,
            }
          ]
        }
      });
    }

    return results;
  }
  
  async getAssignments(query?: { start_date?: string; end_date?: string; user_id?: string }) {
    const where: any = {};
    if (query?.start_date && query?.end_date) {
      where.work_date = {
        gte: new Date(query.start_date),
        lte: new Date(query.end_date),
      };
    }
    if (query?.user_id) {
      where.user_id = query.user_id;
    }
    return this.prisma.shiftAssignment.findMany({
      where,
      include: {
        user: true,
        shift: {
          include: { server: true }
        },
        attendance_logs: true,
      },
      orderBy: { work_date: 'asc' }
    });
  }

  async updateShift(id: string, data: any, actorId?: string) {
    const oldShift = await this.prisma.shift.findUnique({
      where: { id },
      include: { server: true }
    });
    if (oldShift?.week_start_date && (await this.prisma.isDateLocked(oldShift.week_start_date, '12:00'))) {
      throw new BadRequestException('Ca làm này thuộc tuần đã chốt bảng lương. Không thể sửa.');
    }

    let serverId = data.server_id;

    if (data.server_ids && Array.isArray(data.server_ids) && data.server_ids.length > 0) {
      if (data.server_ids.length === 1) {
        serverId = data.server_ids[0];
      } else {
        const dbServers = await this.prisma.server.findMany({
          where: { id: { in: data.server_ids } },
          select: { name: true }
        });
        
        const combinedName = dbServers
          .map(s => s.name)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .join('+');

        let compositeServer = await this.prisma.server.findUnique({
          where: { name: combinedName }
        });

        if (!compositeServer) {
          compositeServer = await this.prisma.server.create({
            data: { name: combinedName }
          });
        }
        
        serverId = compositeServer.id;
      }
    }

    const updated = await this.prisma.shift.update({
      where: { id },
      data: {
        name: data.name,
        server_id: serverId,
        start_time: data.start_time,
        end_time: data.end_time,
        grace_minutes: data.grace_minutes ? parseInt(data.grace_minutes) : undefined,
        base_salary: data.base_salary !== undefined ? (data.base_salary !== null ? Number(data.base_salary) : null) : undefined,
        bonus_salary: data.bonus_salary !== undefined ? Number(data.bonus_salary) : undefined,
        bonus_days: data.bonus_days !== undefined ? data.bonus_days : undefined,
        night_bonus_22_24: data.night_bonus_22_24 !== undefined ? (data.night_bonus_22_24 !== null && data.night_bonus_22_24 !== '' ? Number(data.night_bonus_22_24) : null) : undefined,
        night_bonus_0_3: data.night_bonus_0_3 !== undefined ? (data.night_bonus_0_3 !== null && data.night_bonus_0_3 !== '' ? Number(data.night_bonus_0_3) : null) : undefined,
        night_bonus_3_7: data.night_bonus_3_7 !== undefined ? (data.night_bonus_3_7 !== null && data.night_bonus_3_7 !== '' ? Number(data.night_bonus_3_7) : null) : undefined,
        weekend_bonus: data.weekend_bonus !== undefined ? (data.weekend_bonus !== null && data.weekend_bonus !== '' ? Number(data.weekend_bonus) : null) : undefined,
      },
    });

    if (oldShift) {
      const shiftChanges: Array<{ field: string; label: string; old: any; new: any }> = [];
      const salaryChanges: Array<{ field: string; label: string; old: any; new: any }> = [];

      const serverName = oldShift.server?.name || 'N/A';
      const shiftLabel = updated.name || updated.start_time;

      if (data.name !== undefined && data.name !== oldShift.name) {
        shiftChanges.push({ field: 'name', label: 'Tên ca', old: oldShift.name || 'Không tên', new: data.name || 'Không tên' });
      }
      if (data.start_time !== undefined && data.start_time !== oldShift.start_time) {
        shiftChanges.push({ field: 'start_time', label: 'Giờ bắt đầu', old: oldShift.start_time, new: data.start_time });
        // Reset escalation logs for pending logs in this shift so rescheduled time will re-alert
        await this.prisma.escalationLog.deleteMany({
          where: {
            attendance: {
              shift_assignment: { shift_id: id },
              status: 'PENDING',
            },
          },
        }).catch(() => {});
      }
      if (data.end_time !== undefined && data.end_time !== oldShift.end_time) {
        shiftChanges.push({ field: 'end_time', label: 'Giờ kết thúc', old: oldShift.end_time || 'Không có', new: data.end_time || 'Không có' });
      }
      if (serverId && serverId !== oldShift.server_id) {
        const newServer = await this.prisma.server.findUnique({ where: { id: serverId }, select: { name: true } });
        shiftChanges.push({ field: 'server', label: 'Server', old: serverName, new: newServer?.name || 'N/A' });
      }

      // Salary & compensation diffs
      if (data.base_salary !== undefined && Number(data.base_salary ?? -1) !== Number(oldShift.base_salary ?? -1)) {
        salaryChanges.push({
          field: 'base_salary',
          label: 'Lương cơ bản',
          old: oldShift.base_salary !== null && oldShift.base_salary !== undefined ? `${Number(oldShift.base_salary).toLocaleString('vi-VN')}đ` : 'Mặc định',
          new: data.base_salary !== null && data.base_salary !== undefined ? `${Number(data.base_salary).toLocaleString('vi-VN')}đ` : 'Mặc định',
        });
      }
      if (data.night_bonus_22_24 !== undefined && Number(data.night_bonus_22_24 ?? -1) !== Number(oldShift.night_bonus_22_24 ?? -1)) {
        salaryChanges.push({
          field: 'night_bonus_22_24',
          label: 'Đêm (22h - 23h59)',
          old: oldShift.night_bonus_22_24 !== null && oldShift.night_bonus_22_24 !== undefined ? `${Number(oldShift.night_bonus_22_24).toLocaleString('vi-VN')}đ` : 'Mặc định',
          new: data.night_bonus_22_24 !== null && data.night_bonus_22_24 !== undefined ? `${Number(data.night_bonus_22_24).toLocaleString('vi-VN')}đ` : 'Mặc định',
        });
      }
      if (data.night_bonus_0_3 !== undefined && Number(data.night_bonus_0_3 ?? -1) !== Number(oldShift.night_bonus_0_3 ?? -1)) {
        salaryChanges.push({
          field: 'night_bonus_0_3',
          label: 'Đêm (00h - 2h59)',
          old: oldShift.night_bonus_0_3 !== null && oldShift.night_bonus_0_3 !== undefined ? `${Number(oldShift.night_bonus_0_3).toLocaleString('vi-VN')}đ` : 'Mặc định',
          new: data.night_bonus_0_3 !== null && data.night_bonus_0_3 !== undefined ? `${Number(data.night_bonus_0_3).toLocaleString('vi-VN')}đ` : 'Mặc định',
        });
      }
      if (data.night_bonus_3_7 !== undefined && Number(data.night_bonus_3_7 ?? -1) !== Number(oldShift.night_bonus_3_7 ?? -1)) {
        salaryChanges.push({
          field: 'night_bonus_3_7',
          label: 'Đêm (3h - 6h59)',
          old: oldShift.night_bonus_3_7 !== null && oldShift.night_bonus_3_7 !== undefined ? `${Number(oldShift.night_bonus_3_7).toLocaleString('vi-VN')}đ` : 'Mặc định',
          new: data.night_bonus_3_7 !== null && data.night_bonus_3_7 !== undefined ? `${Number(data.night_bonus_3_7).toLocaleString('vi-VN')}đ` : 'Mặc định',
        });
      }
      if (data.weekend_bonus !== undefined && Number(data.weekend_bonus ?? -1) !== Number(oldShift.weekend_bonus ?? -1)) {
        salaryChanges.push({
          field: 'weekend_bonus',
          label: 'Cuối tuần (T7/CN)',
          old: oldShift.weekend_bonus !== null && oldShift.weekend_bonus !== undefined ? `${Number(oldShift.weekend_bonus).toLocaleString('vi-VN')}đ` : 'Mặc định',
          new: data.weekend_bonus !== null && data.weekend_bonus !== undefined ? `${Number(data.weekend_bonus).toLocaleString('vi-VN')}đ` : 'Mặc định',
        });
      }

      // Log Shift Management changes if any
      if (shiftChanges.length > 0) {
        const changeSummaries = shiftChanges.map(c => `${c.label}: "${c.old}" → "${c.new}"`).join(', ');
        await this.auditLogsService.log({
          actorId,
          page: 'SHIFT_MANAGEMENT',
          action: 'UPDATE',
          entityType: 'Shift',
          entityId: updated.id,
          summary: `Cập nhật ca làm [${shiftLabel}]: ${changeSummaries}`,
          metadata: { changes: shiftChanges, shiftName: shiftLabel, serverName },
        });
      }

      // Log Payroll / Compensation changes if any
      if (salaryChanges.length > 0) {
        const salaryChangeSummaries = salaryChanges.map(c => `${c.label}: "${c.old}" → "${c.new}"`).join(', ');
        await this.auditLogsService.log({
          actorId,
          page: 'PAYROLL',
          action: 'UPDATE',
          entityType: 'ShiftSalary',
          entityId: updated.id,
          summary: `Cấu hình thù lao ca [${shiftLabel}] SV ${serverName}: ${salaryChangeSummaries}`,
          metadata: { changes: salaryChanges, shiftName: shiftLabel, serverName },
        });
      }
    }

    return updated;
  }

  async removeShift(id: string, actorId?: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: { server: true },
    });
    if (shift?.week_start_date && (await this.prisma.isDateLocked(shift.week_start_date, '12:00'))) {
      throw new BadRequestException('Ca làm này thuộc tuần đã chốt bảng lương. Không thể xóa.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Find all assignments for this shift
      const assignments = await tx.shiftAssignment.findMany({
        where: { shift_id: id },
        select: { id: true, work_date: true, shift_id: true },
      });

      for (const a of assignments) {
        if (await this.prisma.isDateLocked(a.work_date, a.shift_id)) {
          throw new BadRequestException('Ca làm này có phân công thuộc ngày đã chốt bảng lương. Không thể xóa.');
        }
      }
      const assignmentIds = assignments.map(a => a.id);

      if (assignmentIds.length > 0) {
        // 2. Find all attendance logs for those assignments
        const logs = await tx.attendanceLog.findMany({
          where: { shift_assignment_id: { in: assignmentIds } },
          select: { id: true },
        });
        const logIds = logs.map(l => l.id);

        if (logIds.length > 0) {
          // 3. Delete escalation logs
          await tx.escalationLog.deleteMany({
            where: { attendance_id: { in: logIds } },
          });
        }

        // 4. Delete attendance logs
        await tx.attendanceLog.deleteMany({
          where: { shift_assignment_id: { in: assignmentIds } },
        });

        // 5. Delete shift assignments
        await tx.shiftAssignment.deleteMany({
          where: { shift_id: id },
        });
      }

      // 6. Delete the shift
      return tx.shift.delete({
        where: { id },
      });
    });

    const serverName = shift?.server?.name || 'N/A';
    const shiftLabel = shift?.name || shift?.start_time || id;

    await this.auditLogsService.log({
      actorId,
      page: 'SHIFT_MANAGEMENT',
      action: 'DELETE',
      entityType: 'Shift',
      entityId: id,
      summary: `Xóa ca làm việc [${shiftLabel}] SV ${serverName}`,
      metadata: {
        serverName,
        shiftName: shiftLabel,
        startTime: shift?.start_time,
      },
    });

    return result;
  }

  async updateAssignment(id: string, data: any, actorId?: string) {
    const existing = await this.prisma.shiftAssignment.findUnique({
      where: { id },
      include: {
        user: true,
        shift: { include: { server: true } }
      }
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy ca phân công');
    }
    if (await this.prisma.isDateLocked(existing.work_date, existing.shift_id)) {
      throw new BadRequestException('Bản phân công này thuộc ngày đã chốt bảng lương. Không thể chỉnh sửa.');
    }
    if (data.work_date && (await this.prisma.isDateLocked(new Date(data.work_date), data.shift_id || existing.shift_id))) {
      throw new BadRequestException('Ngày phân công mới đã bị chốt bảng lương. Không thể chuyển sang.');
    }

    const updatedAssignment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.shiftAssignment.update({
        where: { id },
        data: {
          user_id: data.user_id,
          shift_id: data.shift_id,
          work_date: data.work_date ? new Date(data.work_date) : undefined,
          status: data.status,
        },
      });

      // Also update user_id in the AttendanceLog if user_id was changed
      if (data.user_id) {
        await tx.attendanceLog.updateMany({
          where: { shift_assignment_id: id },
          data: {
            user_id: data.user_id,
          },
        });
      }

      return updated;
    });

    // Audit log
    const changes: Array<{ field: string; label: string; old: any; new: any }> = [];
    if (data.user_id && data.user_id !== existing.user_id) {
      const newUser = await this.prisma.user.findUnique({ where: { id: data.user_id }, select: { full_name: true, username: true } });
      changes.push({
        field: 'assignees',
        label: 'Nhân sự trực ca',
        old: existing.user?.full_name || existing.user?.username || 'Chưa rõ',
        new: newUser?.full_name || newUser?.username || 'Chưa rõ'
      });
    }

    if (changes.length > 0) {
      const formattedDate = `${String(existing.work_date.getDate()).padStart(2, '0')}/${String(existing.work_date.getMonth() + 1).padStart(2, '0')}/${existing.work_date.getFullYear()}`;
      const shiftInfo = `${existing.shift?.name ? `${existing.shift.name} ` : ''}(${existing.shift?.start_time || ''}) SV ${existing.shift?.server?.name || 'N/A'}`;
      await this.auditLogsService.log({
        actorId,
        page: 'SHIFTS',
        action: 'UPDATE',
        entityType: 'ShiftAssignment',
        entityId: existing.shift_id,
        summary: `Đổi nhân sự ca ${shiftInfo} ngày ${formattedDate}: [${changes[0].old}] ➔ [${changes[0].new}]`,
        metadata: {
          serverName: existing.shift?.server?.name || 'N/A',
          shiftName: existing.shift?.name || 'Ca làm',
          startTime: existing.shift?.start_time,
          workDate: formattedDate,
          changes
        }
      });
    }

    return updatedAssignment;
  }

  async removeAssignment(id: string, actorId?: string) {
    const existing = await this.prisma.shiftAssignment.findUnique({
      where: { id },
      include: {
        user: true,
        shift: { include: { server: true } }
      }
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy ca phân công');
    }
    if (await this.prisma.isDateLocked(existing.work_date, existing.shift_id)) {
      throw new BadRequestException('Bản phân công này thuộc ngày đã chốt bảng lương. Không thể xóa.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Delete associated EscalationLogs if any exist (via AttendanceLog)
      const logs = await tx.attendanceLog.findMany({
        where: { shift_assignment_id: id },
        select: { id: true },
      });
      const logIds = logs.map(l => l.id);
      if (logIds.length > 0) {
        await tx.escalationLog.deleteMany({
          where: { attendance_id: { in: logIds } },
        });
      }

      // 2. Delete associated AttendanceLogs
      await tx.attendanceLog.deleteMany({
        where: { shift_assignment_id: id },
      });

      // 3. Delete the ShiftAssignment itself
      return tx.shiftAssignment.delete({
        where: { id },
      });
    });

    const formattedDate = `${String(existing.work_date.getDate()).padStart(2, '0')}/${String(existing.work_date.getMonth() + 1).padStart(2, '0')}/${existing.work_date.getFullYear()}`;
    const shiftInfo = `${existing.shift?.name ? `${existing.shift.name} ` : ''}(${existing.shift?.start_time || ''}) SV ${existing.shift?.server?.name || 'N/A'}`;
    const userName = existing.user?.full_name || existing.user?.username || 'Nhân sự';

    await this.auditLogsService.log({
      actorId,
      page: 'SHIFTS',
      action: 'DELETE',
      entityType: 'ShiftAssignment',
      entityId: existing.shift_id,
      summary: `Xóa nhân viên [${userName}] khỏi ca ${shiftInfo} ngày ${formattedDate}`,
      metadata: {
        serverName: existing.shift?.server?.name || 'N/A',
        shiftName: existing.shift?.name || 'Ca làm',
        startTime: existing.shift?.start_time,
        workDate: formattedDate,
        changes: [
          {
            field: 'assignees',
            label: 'Nhân sự trực ca',
            old: userName,
            new: 'Trống (Đã xóa khỏi ca)',
          }
        ]
      }
    });

    return result;
  }

  async syncAssignments(data: { shift_id: string; work_date: string; user_ids: string[] }, actorId?: string) {
    const workDate = new Date(data.work_date);
    if (await this.prisma.isDateLocked(workDate, data.shift_id)) {
      throw new BadRequestException('Ngày phân ca này đã được chốt bảng lương. Không thể phân công nông dân.');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPastDate = workDate < today;
    const targetUserIds = data.user_ids || [];

    const shift = await this.prisma.shift.findUnique({
      where: { id: data.shift_id },
      include: { server: true }
    });

    let oldUsers: Array<{ id: string; full_name: string; username: string }> = [];
    let targetUsers: Array<{ id: string; full_name: string; username: string }> = [];

    const res = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch current assignments for this slot & date
      const currentAssignments = await tx.shiftAssignment.findMany({
        where: {
          shift_id: data.shift_id,
          work_date: workDate,
        },
        include: {
          user: {
            select: { id: true, full_name: true, username: true }
          }
        }
      });

      oldUsers = currentAssignments.map(a => a.user);
      const currentAssigneeIds = currentAssignments.map(a => a.user_id);

      // Fetch new assigned users for name resolution
      targetUsers = await tx.user.findMany({
        where: { id: { in: targetUserIds } },
        select: { id: true, full_name: true, username: true }
      });

      // 2. Identify who to remove
      const toRemove = currentAssignments.filter(a => !targetUserIds.includes(a.user_id));
      for (const assignment of toRemove) {
        // Delete escalation logs
        const logs = await tx.attendanceLog.findMany({
          where: { shift_assignment_id: assignment.id },
          select: { id: true },
        });
        const logIds = logs.map(l => l.id);
        if (logIds.length > 0) {
          await tx.escalationLog.deleteMany({
            where: { attendance_id: { in: logIds } },
          });
        }
        // Delete attendance logs
        await tx.attendanceLog.deleteMany({
          where: { shift_assignment_id: assignment.id },
        });
        // Delete assignment
        await tx.shiftAssignment.delete({
          where: { id: assignment.id },
        });
      }

      // 3. Identify who to add
      const toAdd = targetUserIds.filter(id => !currentAssigneeIds.includes(id));
      const addedAssignments = [];
      for (const userId of toAdd) {
        const assignment = await tx.shiftAssignment.create({
          data: {
            user_id: userId,
            shift_id: data.shift_id,
            work_date: workDate,
            status: 'SCHEDULED',
          },
          include: {
            user: true,
            shift: true,
          }
        });

        // Create AttendanceLog
        await tx.attendanceLog.create({
          data: {
            user_id: userId,
            shift_assignment_id: assignment.id,
            status: isPastDate ? 'READY' : 'PENDING',
            confirm_at: isPastDate ? new Date() : null,
          }
        });

        addedAssignments.push(assignment);
      }

      // Return the current list of assignments after sync
      const synced = await tx.shiftAssignment.findMany({
        where: {
          shift_id: data.shift_id,
          work_date: workDate,
        },
        include: {
          user: true,
          shift: {
            include: { server: true }
          },
          attendance_logs: true,
        }
      });

      return synced;
    });

    // Compute diffs between old and new staff in this shift slot
    const oldUserIds = oldUsers.map(u => u.id);
    const toRemoveUsers = oldUsers.filter(u => !targetUserIds.includes(u.id));
    const toAddUsers = targetUsers.filter(u => !oldUserIds.includes(u.id));

    // If nothing changed, do not log redundant entry
    if (toRemoveUsers.length > 0 || toAddUsers.length > 0) {
      const formattedDate = `${String(workDate.getDate()).padStart(2, '0')}/${String(workDate.getMonth() + 1).padStart(2, '0')}/${workDate.getFullYear()}`;
      const shiftInfo = `${shift?.name ? `${shift.name} ` : ''}(${shift?.start_time || ''}) SV ${shift?.server?.name || 'N/A'}`;
      
      const oldText = oldUsers.length > 0 ? oldUsers.map(u => u.full_name || u.username).join(', ') : 'Trống';
      const newText = targetUsers.length > 0 ? targetUsers.map(u => u.full_name || u.username).join(', ') : 'Trống (Đã xóa khỏi ca)';

      let action: 'CREATE' | 'UPDATE' | 'DELETE' = 'UPDATE';
      let summary = '';

      if (toRemoveUsers.length > 0 && toAddUsers.length === 0) {
        // DELETE / REMOVAL
        action = 'DELETE';
        const removedNames = toRemoveUsers.map(u => u.full_name || u.username).join(', ');
        summary = `Xóa nhân viên [${removedNames}] khỏi ca ${shiftInfo} ngày ${formattedDate}`;
      } else if (toAddUsers.length > 0 && toRemoveUsers.length === 0) {
        // CREATE / ADDITION
        action = 'CREATE';
        const addedNames = toAddUsers.map(u => u.full_name || u.username).join(', ');
        summary = oldUsers.length === 0
          ? `Phân công [${addedNames}] vào ca ${shiftInfo} ngày ${formattedDate}`
          : `Thêm [${addedNames}] vào ca ${shiftInfo} ngày ${formattedDate}`;
      } else {
        // UPDATE / SWAP
        action = 'UPDATE';
        if (toRemoveUsers.length === 1 && toAddUsers.length === 1) {
          summary = `Đổi nhân sự ca ${shiftInfo} ngày ${formattedDate}: [${toRemoveUsers[0].full_name || toRemoveUsers[0].username}] ➔ [${toAddUsers[0].full_name || toAddUsers[0].username}]`;
        } else {
          summary = `Cập nhật nhân sự ca ${shiftInfo} ngày ${formattedDate}: [${oldText}] ➔ [${newText}]`;
        }
      }

      await this.auditLogsService.log({
        actorId,
        page: 'SHIFTS',
        action,
        entityType: 'ShiftAssignment',
        entityId: data.shift_id,
        summary,
        metadata: {
          serverName: shift?.server?.name || 'N/A',
          shiftName: shift?.name || 'Ca làm',
          startTime: shift?.start_time,
          workDate: formattedDate,
          changes: [
            {
              field: 'assignees',
              label: 'Nhân sự trực ca',
              old: oldText,
              new: newText,
            }
          ]
        },
      });
    }

    return res;
  }

  async cloneWeek(fromWeekStr: string, toWeekStr: string, actorId?: string) {
    const fromWeek = new Date(fromWeekStr);
    const toWeek = new Date(toWeekStr);

    const toWeekEnd = new Date(toWeek);
    toWeekEnd.setDate(toWeekEnd.getDate() + 6);
    if (await this.prisma.isPeriodOverlappingLocked(toWeek, toWeekEnd)) {
      throw new BadRequestException('Tuần nhận lịch sao chép chứa các ngày đã bị chốt bảng lương. Không thể sao chép.');
    }

    // 1. Fetch all shifts from the source week
    const sourceShifts = await this.prisma.shift.findMany({
      where: {
        week_start_date: fromWeek,
      },
    });

    if (sourceShifts.length === 0) {
      return { success: false, message: 'Không tìm thấy ca làm việc ở tuần trước để kế thừa.' };
    }

    const clonedShifts = [];

    // 2. Clone each shift to the target week
    for (const shift of sourceShifts) {
      const cloned = await this.prisma.shift.create({
        data: {
          server_id: shift.server_id,
          name: shift.name,
          start_time: shift.start_time,
          end_time: shift.end_time,
          grace_minutes: shift.grace_minutes,
          base_salary: shift.base_salary,
          bonus_salary: shift.bonus_salary,
          bonus_days: shift.bonus_days,
          night_bonus_22_24: shift.night_bonus_22_24,
          night_bonus_0_3: shift.night_bonus_0_3,
          night_bonus_3_7: shift.night_bonus_3_7,
          weekend_bonus: shift.weekend_bonus,
          week_start_date: toWeek,
        },
      });
      clonedShifts.push(cloned);
    }

    await this.auditLogsService.log({
      actorId,
      page: 'SHIFTS',
      action: 'CLONE',
      entityType: 'Shift',
      summary: `Sao chép lịch ca từ tuần ${fromWeekStr} sang tuần ${toWeekStr} (${clonedShifts.length} ca làm việc)`,
      metadata: { fromWeek: fromWeekStr, toWeek: toWeekStr, count: clonedShifts.length },
    });

    return { success: true, count: clonedShifts.length };
  }

  async importExcel(dto: ImportExcelDto, actorId?: string) {
    const { week_start_date, assignments } = dto;
    const weekStartDate = new Date(week_start_date);

    for (const a of assignments) {
      const workDate = new Date(a.work_date);
      if (await this.prisma.isDateLocked(workDate, a.start_time)) {
        throw new BadRequestException(`Ngày hoặc ca làm ${a.work_date} lúc ${a.start_time} đã bị chốt bảng lương. Không thể nhập.`);
      }
    }

    const txRes = await this.prisma.$transaction(async (tx) => {
      // ===== STEP 1: Delete ALL existing assignments on the imported dates within the current week's cycle =====
      const uniqueWorkDates = Array.from(new Set(assignments.map(a => a.work_date))).map(d => new Date(d));

      const allDateAssignments = await tx.shiftAssignment.findMany({
        where: {
          work_date: { in: uniqueWorkDates },
        },
        include: {
          shift: true,
        },
      });

      // Filter to only delete assignments within the current week's cycle bounds
      const nextMondayDate = new Date(weekStartDate);
      nextMondayDate.setDate(nextMondayDate.getDate() + 7);
      const nextMondayStr = nextMondayDate.toISOString().split('T')[0];
      const weekStartDateStr = week_start_date; // e.g. '2026-06-29'

      const assignmentsToDelete = allDateAssignments.filter(a => {
        const dateStr = a.work_date.toISOString().split('T')[0];
        const startTime = a.shift?.start_time || '00:00';
        const isAfterStart = (dateStr > weekStartDateStr) || (dateStr === weekStartDateStr && startTime >= '07:00');
        const isBeforeEnd = (dateStr < nextMondayStr) || (dateStr === nextMondayStr && startTime < '07:00');
        return isAfterStart && isBeforeEnd;
      });

      const allAssignmentIds = assignmentsToDelete.map(a => a.id);
      const affectedShiftIds = [...new Set(assignmentsToDelete.map(a => a.shift_id))];

      if (allAssignmentIds.length > 0) {
        // Delete escalation logs
        const allLogs = await tx.attendanceLog.findMany({
          where: { shift_assignment_id: { in: allAssignmentIds } },
          select: { id: true },
        });
        const allLogIds = allLogs.map(l => l.id);
        if (allLogIds.length > 0) {
          await tx.escalationLog.deleteMany({
            where: { attendance_id: { in: allLogIds } },
          });
        }
        // Delete attendance logs
        await tx.attendanceLog.deleteMany({
          where: { shift_assignment_id: { in: allAssignmentIds } },
        });
        // Delete all assignments
        await tx.shiftAssignment.deleteMany({
          where: { id: { in: allAssignmentIds } },
        });
      }

      // Delete shifts that are now orphaned (no assignments left)
      for (const shiftId of affectedShiftIds) {
        const remainingAssignments = await tx.shiftAssignment.count({
          where: { shift_id: shiftId },
        });
        if (remainingAssignments === 0) {
          await tx.shift.delete({ where: { id: shiftId } });
        }
      }

      // ===== STEP 2: Create new shifts and assignments from Excel =====
      const results = [];

      for (const item of assignments) {
        // Tách các server nếu có dấu cộng (ví dụ "2914+2658" thành ["2914", "2658"])
        const individualNames = item.server_name
          .split('+')
          .map(name => name.trim())
          .filter(Boolean);

        // Đảm bảo tất cả các server riêng lẻ đều tồn tại trong database
        const dbServers = [];
        for (const name of individualNames) {
          let indServer = await tx.server.findUnique({
            where: { name },
          });
          if (!indServer) {
            indServer = await tx.server.create({
              data: { name },
            });
          }
          dbServers.push(indServer);
        }

        // Tạo/Tìm server gộp (composite server) theo chuẩn sắp xếp số hiệu để gán ca làm
        const combinedName = dbServers
          .map(s => s.name)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .join('+');

        let server = await tx.server.findUnique({
          where: { name: combinedName },
        });
        if (!server) {
          server = await tx.server.create({
            data: { name: combinedName },
          });
        }

        let shift = await tx.shift.findFirst({
          where: {
            server_id: server.id,
            start_time: item.start_time,
            week_start_date: weekStartDate,
          },
        });
        if (!shift) {
          shift = await tx.shift.create({
            data: {
              server_id: server.id,
              name: item.shift_name || null,
              start_time: item.start_time,
              end_time: '',
              grace_minutes: 5,
              base_salary: null,
              bonus_salary: 0,
              week_start_date: weekStartDate,
            },
          });
        } else {
          shift = await tx.shift.update({
            where: { id: shift.id },
            data: {
              name: item.shift_name || null,
            },
          });
        }

        const workDate = new Date(item.work_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPastDate = workDate < today;

        // Deduplicate user_ids to avoid unique constraint violation
        const uniqueUserIds = [...new Set(item.user_ids)];

        for (const userId of uniqueUserIds) {
          // Check if assignment already exists (could happen if Excel has duplicate rows for same shift)
          const existing = await tx.shiftAssignment.findFirst({
            where: {
              shift_id: shift.id,
              work_date: workDate,
              user_id: userId,
            },
          });
          if (existing) {
            results.push(existing);
            continue;
          }

          const assignment = await tx.shiftAssignment.create({
            data: {
              user_id: userId,
              shift_id: shift.id,
              work_date: workDate,
              status: 'SCHEDULED',
            },
          });

          await tx.attendanceLog.create({
            data: {
              user_id: userId,
              shift_assignment_id: assignment.id,
              status: isPastDate ? 'READY' : 'PENDING',
              confirm_at: isPastDate ? new Date() : null,
            },
          });

          results.push(assignment);
        }
      }

      return { success: true, count: results.length };
    }, {
      timeout: 50000
    });

    await this.auditLogsService.log({
      actorId,
      page: 'SHIFTS',
      action: 'EXCEL_IMPORT',
      entityType: 'ShiftAssignment',
      summary: `Tải lên file Excel ${dto.file_name ? `"${dto.file_name}" ` : ''}cho tuần ${dto.week_start_date}: ${txRes.count} lượt phân ca`,
      metadata: {
        fileName: dto.file_name || 'excel_import.xlsx',
        weekStartDate: dto.week_start_date,
        importedCount: txRes.count,
        totalRows: dto.assignments.length,
      },
    });

    return txRes;
  }
}
