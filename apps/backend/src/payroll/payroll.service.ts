import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) { }


  formatDateOnly(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }

  private parseDateOnly(dateStr: string) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private addDaysDateOnly(dateStr: string, days: number) {
    const date = this.parseDateOnly(dateStr);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
  }

  async calculatePayroll(startDateStr: string, endDateStr: string, userId?: string, forceDynamic = false) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (!forceDynamic) {
      const lockedPeriod = await this.prisma.lockedPeriod.findFirst({
        where: {
          start_date: { lte: start },
          end_date: { gte: end },
        },
        include: {
          payrolls: true,
        },
      });

      if (lockedPeriod) {
        const payrolls = userId
          ? lockedPeriod.payrolls.filter((p) => p.user_id === userId)
          : lockedPeriod.payrolls;

        return payrolls.map((p) => {
          // Filter shift details to only include shifts within [start, end]
          const rawDetails = p.details as any[] || [];
          const details = rawDetails.filter((d) => {
            if (!d.workDate) return false;
            const wDate = new Date(d.workDate);
            return wDate >= start && wDate <= end;
          });

          // Recalculate totals based on filtered details
          let totalShifts = details.length;
          let completedShifts = 0;
          let absentShifts = 0;
          let totalBaseSalary = 0;
          let totalNightBonus = 0;
          let totalWeekendBonus = 0;
          let totalOtherAllowance = 0;
          let totalShiftReward = 0;
          let totalSalary = 0;

          for (const d of details) {
            if (d.status === 'ABSENT') {
              absentShifts += 1;
            }
            if (d.isCompleted) {
              completedShifts += 1;
              totalBaseSalary += d.baseSalary || 0;
              totalNightBonus += d.nightBonus || 0;
              totalWeekendBonus += d.weekendBonus || 0;
              totalOtherAllowance += d.otherAllowance || 0;
              totalShiftReward += d.shiftReward || 0;
              totalSalary += d.totalSalary || 0;
            }
          }

          return {
            userId: p.user_id,
            username: p.username,
            fullName: p.full_name,
            role: p.role,
            totalShifts,
            completedShifts,
            absentShifts,
            totalBaseSalary,
            totalNightBonus,
            totalWeekendBonus,
            totalOtherAllowance,
            totalShiftReward,
            adjustmentPercent: (p as any).adjustment_percent || 0,
            totalAdjustment: (p as any).total_adjustment || 0,
            fundPercent: (p as any).fund_percent || 0,
            totalFundShared: (p as any).total_fund_shared || 0,
            totalSalary: p.total_salary,
            details,
          };
        });
      }
    }

    const startDbDate = this.parseDateOnly(startDateStr);
    const endDbDate = this.parseDateOnly(endDateStr);

    const adjustments = await this.prisma.payrollAdjustment.findMany({
      where: {
        start_date: startDbDate,
        end_date: endDbDate,
        ...(userId ? { user_id: userId } : {}),
      },
    });

    const adjustmentMap = new Map<string, { percent: number; fundPercent: number; note: string }>();
    for (const adj of adjustments) {
      adjustmentMap.set(adj.user_id, {
        percent: adj.adjustment_percent,
        fundPercent: (adj as any).fund_percent || 0,
        note: adj.note || '',
      });
    }

    // Fetch weekly fund
    const weeklyFundRecord = await this.prisma.weeklyFund.findUnique({
      where: { start_date: startDbDate },
    });
    const weeklyFundAmount = weeklyFundRecord ? weeklyFundRecord.amount : 0;

    // Fetch system-wide configurations
    const rawNight22_24 = await this.prisma.getSetting('NIGHT_SHIFT_22_24_BONUS', '10000');
    const rawNight0_3 = await this.prisma.getSetting('NIGHT_SHIFT_0_3_BONUS', '10000');
    const rawNight3_7 = await this.prisma.getSetting('NIGHT_SHIFT_3_7_BONUS', '20000');
    const rawWeekend = await this.prisma.getSetting('WEEKEND_BONUS', '20000');
    const rawDefaultSalary = await this.prisma.getSetting('DEFAULT_SERVER_SALARY', '100000');

    const bonusNight22_24 = parseFloat(rawNight22_24);
    const bonusNight0_3 = parseFloat(rawNight0_3);
    const bonusNight3_7 = parseFloat(rawNight3_7);
    const bonusWeekend = parseFloat(rawWeekend);
    const defaultSalary = parseFloat(rawDefaultSalary);

    const allowanceDates = await this.prisma.payrollAllowance.findMany({
      where: {
        work_date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
    const allowanceByDate = new Map(
      allowanceDates.map((allowance) => [this.formatDateOnly(allowance.work_date), allowance.amount]),
    );

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

    const isRangeFilter = startDateStr !== endDateStr;
    const startBoundary = `${startDateStr}T07:00:00`;
    const endBoundary = `${endDateStr}T06:59:59`;

    const salaryHistories = await this.prisma.serverSalaryHistory.findMany({
      where: {
        start_date: { lte: endDate },
      },
      orderBy: { start_date: 'desc' },
    });

    for (const assignment of assignments) {
      if (isRangeFilter) {
        const assignmentTimeStr = `${this.formatDateOnly(assignment.work_date)}T${assignment.shift.start_time || '00:00'}:00`;
        if (assignmentTimeStr < startBoundary || assignmentTimeStr > endBoundary) {
          continue;
        }
      }

      // Ensure the assignment's work_date matches the shift's week_start_date week boundaries
      const shiftWeekStart = assignment.shift.week_start_date;
      if (shiftWeekStart) {
        const [sh, sm] = (assignment.shift.start_time || '00:00').split(':').map(Number);
        const cellDate = new Date(assignment.work_date);
        cellDate.setHours(sh, sm, 0, 0);

        const weekStart = new Date(shiftWeekStart);
        weekStart.setHours(7, 0, 0, 0);

        const weekEnd = new Date(shiftWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        weekEnd.setHours(7, 0, 0, 0);

        if (cellDate < weekStart || cellDate >= weekEnd) {
          continue;
        }
      }

      const user = assignment.user;
      const log = assignment.attendance_logs?.[0];

      // A shift is counted for payroll as soon as staff is assigned to it.
      const isCompleted = true;

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
          totalOtherAllowance: 0,
          totalShiftReward: 0,
          totalSalary: 0,
          fundPercent: 0,
          totalFundShared: 0,
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
      let appliedOtherAllowance = 0;
      let shiftReward = 0;
      let totalSalary = 0;

      if (isCompleted) {
        payroll.completedShifts += 1;

        // 1. Base Salary
        const shiftBase = assignment.shift.base_salary;
        const shiftWeekStart = assignment.shift.week_start_date;
        const histBase = salaryHistories.find((h) => {
          if (h.server_id !== assignment.shift.server_id) return false;
          if (shiftWeekStart) {
            return h.start_date.getTime() === shiftWeekStart.getTime();
          }
          const start = new Date(h.start_date);
          const end = new Date(start);
          end.setDate(start.getDate() + 7);
          return assignment.work_date >= start && assignment.work_date < end;
        })?.base_salary;
        const serverBase = histBase !== undefined ? histBase : assignment.shift.server?.base_salary;

        baseSalary = shiftBase !== null && shiftBase !== undefined
          ? shiftBase
          : (serverBase !== null && serverBase !== undefined && serverBase > 0 ? serverBase : defaultSalary);

        // 2. Night Shift Bonus
        const startTime = assignment.shift.start_time || '00:00';
        const [sh, sm] = startTime.split(':').map(Number);
        const startHours = sh + sm / 60;

        const isNightShift = (startHours >= 22 && startHours < 24) || (startHours >= 0 && startHours < 7);
        if (isNightShift) {
          // Check if starts in [22:00, 23:59] (meaning >= 22 and < 24)
          if (startHours >= 22 && startHours < 24) {
            nightBonus = (assignment.shift as any).night_bonus_22_24 !== null && (assignment.shift as any).night_bonus_22_24 !== undefined
              ? (assignment.shift as any).night_bonus_22_24
              : bonusNight22_24;
          }
          // Check if starts in [00:00, 02:59] (meaning >= 0 and < 3)
          else if (startHours >= 0 && startHours < 3) {
            nightBonus = (assignment.shift as any).night_bonus_0_3 !== null && (assignment.shift as any).night_bonus_0_3 !== undefined
              ? (assignment.shift as any).night_bonus_0_3
              : bonusNight0_3;
          }
          // Check if starts in [03:00, 06:59] (meaning >= 3 and < 7)
          else if (startHours >= 3 && startHours < 7) {
            nightBonus = (assignment.shift as any).night_bonus_3_7 !== null && (assignment.shift as any).night_bonus_3_7 !== undefined
              ? (assignment.shift as any).night_bonus_3_7
              : bonusNight3_7;
          }
        }

        // 3. Weekend Bonus
        // A shift gets weekend bonus if its start time falls within:
        // 7:00 AM Saturday -> 6:59 AM Monday
        const workDate = new Date(assignment.work_date);
        const [sh2, sm2] = startTime.split(':').map(Number);
        const shiftStartDateTime = new Date(workDate);
        shiftStartDateTime.setHours(sh2, sm2, 0, 0);

        // Calculate boundaries:
        // Saturday 7:00 AM of the same week
        const dayOfWeek = workDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const saturday7am = new Date(workDate);
        // Days to go back to Saturday:
        // If Sun(0): go back 1 day -> Sat
        // If Mon(1): go back 2 days -> Sat
        // If Tue(2): go back 3 days -> Sat
        // ... If Sat(6): go back 0 days -> Sat
        const daysBackToSat = (dayOfWeek + 1) % 7; // Sun=1, Mon=2, ..., Sat=0
        saturday7am.setDate(workDate.getDate() - daysBackToSat);
        saturday7am.setHours(7, 0, 0, 0);

        // Monday 7:00 AM = Saturday 7:00 AM + 2 days
        const monday7am = new Date(saturday7am);
        monday7am.setDate(monday7am.getDate() + 2);
        monday7am.setHours(7, 0, 0, 0);

        if (shiftStartDateTime >= saturday7am && shiftStartDateTime < monday7am) {
          if (assignment.shift.weekend_bonus !== null && assignment.shift.weekend_bonus !== undefined) {
            weekendBonus = assignment.shift.weekend_bonus;
          } else {
            weekendBonus = bonusWeekend;
          }
        }

        // 4. Date-specific allowance
        appliedOtherAllowance = allowanceByDate.get(this.formatDateOnly(assignment.work_date)) || 0;
        
        shiftReward = 0;
        if (assignment.shift.bonus_salary > 0) {
          const bonusDays = (assignment.shift as any).bonus_days;
          if (bonusDays) {
            const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'Asia/Ho_Chi_Minh',
              weekday: 'short',
            });
            const weekdayStr = weekdayFormatter.format(assignment.work_date);
            const dayMap: Record<string, string> = {
              'Sun': 'CN',
              'Mon': '2',
              'Tue': '3',
              'Wed': '4',
              'Thu': '5',
              'Fri': '6',
              'Sat': '7'
            };
            const dayStr = dayMap[weekdayStr];
            if (bonusDays.split(',').includes(dayStr)) {
              shiftReward = assignment.shift.bonus_salary;
            }
          } else {
            shiftReward = assignment.shift.bonus_salary;
          }
        }

        // 5. Total Shift Salary
        totalSalary = baseSalary + nightBonus + weekendBonus + appliedOtherAllowance + shiftReward;

        // Accumulate totals
        payroll.totalBaseSalary += baseSalary;
        payroll.totalNightBonus += nightBonus;
        payroll.totalWeekendBonus += weekendBonus;
        payroll.totalOtherAllowance += appliedOtherAllowance;
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
        otherAllowance: appliedOtherAllowance,
        shiftReward,
        totalSalary,
        isCompleted,
      });
    }

    const result = Array.from(userPayrollMap.values());
    for (const payroll of result) {
      const adj = adjustmentMap.get(payroll.userId) || { percent: 0, fundPercent: 0, note: '' };
      payroll.adjustmentPercent = adj.percent;
      payroll.fundPercent = adj.fundPercent;
      
      const grossSalary = payroll.totalSalary;
      const baseSalaryForAdj = payroll.totalBaseSalary;
      const totalAdjustment = Math.round(baseSalaryForAdj * (adj.percent / 100));
      
      const totalFundShared = Math.round(weeklyFundAmount * (adj.fundPercent / 100));
      payroll.totalFundShared = totalFundShared;

      payroll.totalAdjustment = totalAdjustment;
      payroll.totalSalary = grossSalary + totalAdjustment + totalFundShared;
      payroll.adjustmentNote = adj.note;
    }

    return result;
  }

  async getSettings() {
    const rawNight22_24 = await this.prisma.getSetting('NIGHT_SHIFT_22_24_BONUS', '10000');
    const rawNight0_3 = await this.prisma.getSetting('NIGHT_SHIFT_0_3_BONUS', '10000');
    const rawNight3_7 = await this.prisma.getSetting('NIGHT_SHIFT_3_7_BONUS', '20000');
    const rawWeekend = await this.prisma.getSetting('WEEKEND_BONUS', '20000');
    const rawDefaultSalary = await this.prisma.getSetting('DEFAULT_SERVER_SALARY', '100000');

    return {
      nightShift22_24Bonus: parseFloat(rawNight22_24),
      nightShift0_3Bonus: parseFloat(rawNight0_3),
      nightShift3_7Bonus: parseFloat(rawNight3_7),
      weekendBonus: parseFloat(rawWeekend),
      defaultServerSalary: parseFloat(rawDefaultSalary),
    };
  }

  async updateSettings(body: {
    nightShift22_24Bonus?: number;
    nightShift0_3Bonus?: number;
    nightShift3_7Bonus?: number;
    weekendBonus?: number;
    defaultServerSalary?: number;
  }) {
    if (body.nightShift22_24Bonus !== undefined) {
      await this.prisma.setSetting('NIGHT_SHIFT_22_24_BONUS', body.nightShift22_24Bonus.toString());
    }
    if (body.nightShift0_3Bonus !== undefined) {
      await this.prisma.setSetting('NIGHT_SHIFT_0_3_BONUS', body.nightShift0_3Bonus.toString());
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

  async getAllowances(startDateStr?: string, endDateStr?: string) {
    const where: any = {};
    if (startDateStr && endDateStr) {
      where.work_date = {
        gte: this.parseDateOnly(startDateStr),
        lte: this.parseDateOnly(endDateStr),
      };
    }

    return this.prisma.payrollAllowance.findMany({
      where,
      orderBy: { work_date: 'asc' },
    });
  }

  async upsertAllowance(body: { work_date: string; amount: number; note?: string }) {
    const workDate = this.parseDateOnly(body.work_date);
    if (await this.prisma.isDateLocked(workDate)) {
      throw new BadRequestException('Ngày phụ cấp này thuộc giai đoạn đã chốt bảng lương. Không thể chỉnh sửa.');
    }

    return this.prisma.payrollAllowance.upsert({
      where: { work_date: workDate },
      update: {
        amount: Number(body.amount) || 0,
        note: body.note || null,
      },
      create: {
        work_date: workDate,
        amount: Number(body.amount) || 0,
        note: body.note || null,
      },
    });
  }

  async updateAllowance(id: string, body: { work_date: string; amount: number; note?: string }) {
    const existing = await this.prisma.payrollAllowance.findUnique({ where: { id } });
    if (!existing) {
      throw new BadRequestException('Không tìm thấy ngày phụ cấp.');
    }
    if (await this.prisma.isDateLocked(existing.work_date)) {
      throw new BadRequestException('Ngày phụ cấp này thuộc giai đoạn đã chốt bảng lương. Không thể chỉnh sửa.');
    }

    const workDate = this.parseDateOnly(body.work_date);
    if (await this.prisma.isDateLocked(workDate)) {
      throw new BadRequestException('Ngày phụ cấp mới thuộc giai đoạn đã chốt bảng lương. Không thể chỉnh sửa.');
    }

    return this.prisma.payrollAllowance.update({
      where: { id },
      data: {
        work_date: workDate,
        amount: Number(body.amount) || 0,
        note: body.note || null,
      },
    });
  }

  async deleteAllowance(id: string) {
    const existing = await this.prisma.payrollAllowance.findUnique({ where: { id } });
    if (!existing) {
      throw new BadRequestException('Không tìm thấy ngày phụ cấp.');
    }
    if (await this.prisma.isDateLocked(existing.work_date)) {
      throw new BadRequestException('Ngày phụ cấp này thuộc giai đoạn đã chốt bảng lương. Không thể xóa.');
    }

    return this.prisma.payrollAllowance.delete({ where: { id } });
  }

  async getPeriodLockStatus(startDateStr: string, endDateStr: string) {
    const start = this.parseDateOnly(startDateStr);
    const end = this.parseDateOnly(endDateStr);

    const locked = await this.prisma.lockedPeriod.findFirst({
      where: {
        start_date: { lte: start },
        end_date: { gte: end },
      },
    });

    if (locked) {
      const lockedStartDate = this.formatDateOnly(locked.start_date);
      const lockedEndDate = this.formatDateOnly(locked.end_date);

      return {
        locked: true,
        startDate: this.addDaysDateOnly(lockedStartDate, 1) === startDateStr ? startDateStr : lockedStartDate,
        endDate: lockedEndDate,
      };
    }

    return { locked: false };
  }

  async lockPeriod(startDateStr: string, endDateStr: string) {
    const start = this.parseDateOnly(startDateStr);
    const end = this.parseDateOnly(endDateStr);

    // 1. Kiểm tra xem đã chốt chưa
    const existing = await this.prisma.lockedPeriod.findFirst({
      where: {
        start_date: start,
        end_date: end,
      },
    });

    if (existing) {
      return { success: true, message: 'Bảng lương giai đoạn này đã được chốt từ trước.' };
    }

    // 2. Tính toán bảng lương động tại thời điểm này
    const payroll = await this.calculatePayroll(startDateStr, endDateStr, undefined, true);

    // 3. Tạo locked period và các bản ghi payroll snapshot tương ứng
    await this.prisma.$transaction(async (tx) => {
      const lockedPeriod = await tx.lockedPeriod.create({
        data: {
          start_date: start,
          end_date: end,
        },
      });

      for (const record of payroll) {
        await tx.lockedPayroll.create({
          data: {
            locked_period_id: lockedPeriod.id,
            user_id: record.userId,
            username: record.username,
            full_name: record.fullName,
            role: record.role,
            total_shifts: record.totalShifts,
            completed_shifts: record.completedShifts,
            absent_shifts: record.absentShifts,
            total_base_salary: record.totalBaseSalary,
            total_night_bonus: record.totalNightBonus,
            total_weekend_bonus: record.totalWeekendBonus,
            total_other_allowance: record.totalOtherAllowance,
            total_shift_reward: record.totalShiftReward,
            adjustment_percent: record.adjustmentPercent || 0,
            total_adjustment: record.totalAdjustment || 0,
            fund_percent: record.fundPercent || 0,
            total_fund_shared: record.totalFundShared || 0,
            total_salary: record.totalSalary,
            details: record.details,
          },
        });
      }
    });

    return { success: true };
  }

  async unlockPeriod(startDateStr: string, endDateStr: string) {
    const start = this.parseDateOnly(startDateStr);
    const end = this.parseDateOnly(endDateStr);

    const locked = await this.prisma.lockedPeriod.findFirst({
      where: {
        start_date: { lte: start },
        end_date: { gte: end },
      },
    });

    if (!locked) {
      return { success: false, message: 'Không tìm thấy bảng lương đã chốt trong khoảng thời gian này.' };
    }

    await this.prisma.lockedPeriod.delete({
      where: { id: locked.id },
    });

    return { success: true };
  }

  async upsertAdjustment(body: {
    userId: string;
    startDate: string;
    endDate: string;
    adjustmentPercent?: number;
    fundPercent?: number;
    note?: string;
  }) {
    const start = this.parseDateOnly(body.startDate);
    const end = this.parseDateOnly(body.endDate);

    const locked = await this.prisma.lockedPeriod.findFirst({
      where: {
        start_date: { lte: start },
        end_date: { gte: end },
      },
    });

    if (locked) {
      throw new BadRequestException('Giai đoạn này đã chốt bảng lương. Không thể điều chỉnh.');
    }

    const updateData: any = {};
    if (body.adjustmentPercent !== undefined) {
      updateData.adjustment_percent = Number(body.adjustmentPercent) || 0;
    }
    if (body.fundPercent !== undefined) {
      updateData.fund_percent = Number(body.fundPercent) || 0;
    }
    if (body.note !== undefined) {
      updateData.note = body.note || null;
    }

    const createData: any = {
      user_id: body.userId,
      start_date: start,
      end_date: end,
      adjustment_percent: Number(body.adjustmentPercent) || 0,
      fund_percent: Number(body.fundPercent) || 0,
      note: body.note || null,
    };

    return this.prisma.payrollAdjustment.upsert({
      where: {
        user_id_start_date_end_date: {
          user_id: body.userId,
          start_date: start,
          end_date: end,
        },
      },
      update: updateData,
      create: createData,
    });
  }

  async getWeeklyFund(startDateStr: string) {
    const start = this.parseDateOnly(startDateStr);
    return this.prisma.weeklyFund.findUnique({
      where: { start_date: start },
    });
  }

  async upsertWeeklyFund(body: { start_date: string; end_date: string; amount: number }) {
    const start = this.parseDateOnly(body.start_date);
    const end = this.parseDateOnly(body.end_date);

    if (await this.prisma.isDateLocked(start)) {
      throw new BadRequestException('Tuần này đã chốt bảng lương. Không thể chỉnh sửa quỹ.');
    }

    return this.prisma.weeklyFund.upsert({
      where: { start_date: start },
      update: {
        amount: Number(body.amount) || 0,
        end_date: end,
      },
      create: {
        start_date: start,
        end_date: end,
        amount: Number(body.amount) || 0,
      },
    });
  }
}
