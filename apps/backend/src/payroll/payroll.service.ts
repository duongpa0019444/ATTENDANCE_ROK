import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async calculatePayroll(startDateStr: string, endDateStr: string, userId?: string) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    // Fetch system-wide configurations
    const rawNight22_3 = await this.prisma.getSetting('NIGHT_SHIFT_22_3_BONUS', '10000');
    const rawNight3_7 = await this.prisma.getSetting('NIGHT_SHIFT_3_7_BONUS', '20000');
    const rawWeekend = await this.prisma.getSetting('WEEKEND_BONUS', '20000');
    const rawDefaultSalary = await this.prisma.getSetting('DEFAULT_SERVER_SALARY', '100000');

    const bonusNight22_3 = parseFloat(rawNight22_3);
    const bonusNight3_7 = parseFloat(rawNight3_7);
    const bonusWeekend = parseFloat(rawWeekend);
    const defaultSalary = parseFloat(rawDefaultSalary);

    // Fetch shift assignments
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        work_date: {
          gte: startDate,
          lte: endDate,
        },
        ...(userId ? { user_id: userId } : {}),
      },
      include: {
        user: true,
        shift: {
          include: {
            server: true,
          },
        },
        attendance_logs: true,
      },
      orderBy: {
        work_date: 'asc',
      },
    });

    // Grouping map
    const userPayrollMap = new Map<string, any>();

    for (const assignment of assignments) {
      const user = assignment.user;
      const log = assignment.attendance_logs?.[0];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const workDate = new Date(assignment.work_date);
      workDate.setHours(0, 0, 0, 0);
      
      // Chỉ cần được phân ca và đã qua ngày đó là được tính
      const isCompleted = workDate < today;

      if (!userPayrollMap.has(user.id)) {
        userPayrollMap.set(user.id, {
          userId: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role,
          totalShifts: 0,
          completedShifts: 0,
          absentShifts: 0,
          totalBaseSalary: 0,
          totalNightBonus: 0,
          totalWeekendBonus: 0,
          totalShiftReward: 0,
          totalSalary: 0,
          details: [],
        });
      }

      const payroll = userPayrollMap.get(user.id);
      payroll.totalShifts += 1;

      if (log?.status === 'ABSENT') {
        payroll.absentShifts += 1;
      }

      // Calculations if the user actually worked
      let baseSalary = 0;
      let nightBonus = 0;
      let weekendBonus = 0;
      let shiftReward = 0;
      let totalSalary = 0;

      if (isCompleted) {
        payroll.completedShifts += 1;

        // 1. Base Salary
        const shiftBase = assignment.shift.base_salary;
        const serverBase = assignment.shift.server?.base_salary;
        baseSalary = shiftBase !== null && shiftBase !== undefined 
          ? shiftBase 
          : (serverBase !== null && serverBase !== undefined && serverBase > 0 ? serverBase : defaultSalary);

        // 2. Night Shift Bonus
        const startTime = assignment.shift.start_time || '00:00';
        const [sh, sm] = startTime.split(':').map(Number);
        const startHours = sh + sm / 60;

        // Check if starts in [22:00, 03:00] (meaning >= 22 or <= 3)
        if (startHours >= 22 || startHours <= 3) {
          nightBonus = bonusNight22_3;
        }
        // Check if starts in (03:00, 07:00] (meaning > 3 and <= 7)
        else if (startHours > 3 && startHours <= 7) {
          nightBonus = bonusNight3_7;
        }

        // 3. Weekend Bonus
        const workDate = new Date(assignment.work_date);
        const day = workDate.getDay(); // 0 = Sunday, 6 = Saturday
        if (day === 0 || day === 6) {
          weekendBonus = bonusWeekend;
        }

        // 4. Shift Reward
        shiftReward = assignment.shift.bonus_salary || 0;

        // 5. Total Shift Salary
        totalSalary = baseSalary + nightBonus + weekendBonus + shiftReward;

        // Accumulate totals
        payroll.totalBaseSalary += baseSalary;
        payroll.totalNightBonus += nightBonus;
        payroll.totalWeekendBonus += weekendBonus;
        payroll.totalShiftReward += shiftReward;
        payroll.totalSalary += totalSalary;
      }

      // Append shift details breakdown
      payroll.details.push({
        assignmentId: assignment.id,
        workDate: assignment.work_date,
        shiftName: assignment.shift.name,
        serverName: assignment.shift.server?.name || 'N/A',
        startTime: assignment.shift.start_time,
        endTime: assignment.shift.end_time,
        status: log?.status || 'PENDING',
        baseSalary,
        nightBonus,
        weekendBonus,
        shiftReward,
        totalSalary,
        isCompleted,
      });
    }

    return Array.from(userPayrollMap.values());
  }

  async getSettings() {
    const rawNight22_3 = await this.prisma.getSetting('NIGHT_SHIFT_22_3_BONUS', '10000');
    const rawNight3_7 = await this.prisma.getSetting('NIGHT_SHIFT_3_7_BONUS', '20000');
    const rawWeekend = await this.prisma.getSetting('WEEKEND_BONUS', '20000');
    const rawDefaultSalary = await this.prisma.getSetting('DEFAULT_SERVER_SALARY', '100000');

    return {
      nightShift22_3Bonus: parseFloat(rawNight22_3),
      nightShift3_7Bonus: parseFloat(rawNight3_7),
      weekendBonus: parseFloat(rawWeekend),
      defaultServerSalary: parseFloat(rawDefaultSalary),
    };
  }

  async updateSettings(body: {
    nightShift22_3Bonus?: number;
    nightShift3_7Bonus?: number;
    weekendBonus?: number;
    defaultServerSalary?: number;
  }) {
    if (body.nightShift22_3Bonus !== undefined) {
      await this.prisma.setSetting('NIGHT_SHIFT_22_3_BONUS', body.nightShift22_3Bonus.toString());
    }
    if (body.nightShift3_7Bonus !== undefined) {
      await this.prisma.setSetting('NIGHT_SHIFT_3_7_BONUS', body.nightShift3_7Bonus.toString());
    }
    if (body.weekendBonus !== undefined) {
      await this.prisma.setSetting('WEEKEND_BONUS', body.weekendBonus.toString());
    }
    if (body.defaultServerSalary !== undefined) {
      await this.prisma.setSetting('DEFAULT_SERVER_SALARY', body.defaultServerSalary.toString());
    }
    return { success: true };
  }
}
