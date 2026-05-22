import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async findAllShifts() {
    return this.prisma.shift.findMany({
      orderBy: { created_at: 'desc' }
    });
  }

  async createShift(data: any) {
    return this.prisma.shift.create({
      data: {
        name: data.name,
        start_time: data.start_time,
        end_time: data.end_time,
        grace_minutes: data.grace_minutes ? parseInt(data.grace_minutes) : 5,
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

      // Auto create AttendanceLog with PENDING status
      await this.prisma.attendanceLog.create({
        data: {
          user_id: data.user_id,
          shift_assignment_id: assignment.id,
          status: 'PENDING'
        }
      });

      results.push(assignment);
    }

    return results;
  }
  
  async getAssignments() {
    return this.prisma.shiftAssignment.findMany({
      include: {
        user: true,
        shift: true,
        attendance_logs: true,
      },
      orderBy: { work_date: 'desc' }
    });
  }

  async updateShift(id: string, data: any) {
    return this.prisma.shift.update({
      where: { id },
      data: {
        name: data.name,
        start_time: data.start_time,
        end_time: data.end_time,
        grace_minutes: data.grace_minutes ? parseInt(data.grace_minutes) : undefined,
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
}
