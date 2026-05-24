import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async findAllShifts() {
    return this.prisma.shift.findMany({
      include: { server: true },
      orderBy: { created_at: 'desc' }
    });
  }

  async createShift(data: any) {
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

    return this.prisma.shift.create({
      data: {
        name: data.name,
        server_id: serverId,
        start_time: data.start_time,
        end_time: data.end_time,
        grace_minutes: data.grace_minutes ? parseInt(data.grace_minutes) : 5,
        base_salary: data.base_salary !== undefined && data.base_salary !== null ? Number(data.base_salary) : null,
        bonus_salary: data.bonus_salary !== undefined && data.bonus_salary !== null ? Number(data.bonus_salary) : 0,
      }
    });
  }

  async assignShift(data: any) {
    // Support both single work_date and array work_dates
    const dates: string[] = data.work_dates
      ? data.work_dates
      : [data.work_date];

    const results = [];

    for (const dateStr of dates) {
      const workDate = new Date(dateStr);

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
          shift: true,
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

  async updateShift(id: string, data: any) {
    return this.prisma.shift.update({
      where: { id },
      data: {
        name: data.name,
        server_id: data.server_id,
        start_time: data.start_time,
        end_time: data.end_time,
        grace_minutes: data.grace_minutes ? parseInt(data.grace_minutes) : undefined,
        base_salary: data.base_salary !== undefined ? (data.base_salary !== null ? Number(data.base_salary) : null) : undefined,
        bonus_salary: data.bonus_salary !== undefined ? Number(data.bonus_salary) : undefined,
      },
    });
  }

  async removeShift(id: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Find all assignments for this shift
      const assignments = await tx.shiftAssignment.findMany({
        where: { shift_id: id },
        select: { id: true },
      });
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
  }

  async updateAssignment(id: string, data: any) {
    return this.prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.shiftAssignment.update({
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

      return updatedAssignment;
    });
  }

  async removeAssignment(id: string) {
    return this.prisma.$transaction(async (tx) => {
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
  }

  async syncAssignments(data: { shift_id: string; work_date: string; user_ids: string[] }) {
    const workDate = new Date(data.work_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPastDate = workDate < today;
    const targetUserIds = data.user_ids || [];

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch current assignments for this slot & date
      const currentAssignments = await tx.shiftAssignment.findMany({
        where: {
          shift_id: data.shift_id,
          work_date: workDate,
        },
      });

      const currentAssigneeIds = currentAssignments.map(a => a.user_id);

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
      return tx.shiftAssignment.findMany({
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
    });
  }
}
