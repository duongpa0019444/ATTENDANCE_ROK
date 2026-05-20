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
    const workDate = new Date(data.work_date); 
    
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

    return assignment;
  }
  
  async getAssignments() {
    return this.prisma.shiftAssignment.findMany({
      include: {
        user: true,
        shift: true,
      },
      orderBy: { work_date: 'desc' }
    });
  }
}
