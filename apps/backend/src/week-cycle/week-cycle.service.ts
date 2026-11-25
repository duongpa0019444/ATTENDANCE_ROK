import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export interface WeekBoundaryResult {
  is_custom: boolean;
  name?: string | null;
  rule_id?: string;
  custom_period_id?: string;
  start_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_date: string;   // YYYY-MM-DD
  end_time: string;   // HH:mm
  total_days: number;
  start_day_of_week?: number; // 0-6
  label: string;
}

@Injectable()
export class WeekCycleService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  /**
   * Format Date to YYYY-MM-DD in UTC (matches @db.Date representation in Prisma)
   */
  formatDateOnly(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  parseDateOnly(dateStr: string): Date {
    const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  /**
   * Resolves the exact boundaries of the week cycle that encloses targetDate
   */
  async getWeekBoundaries(targetDateInput?: Date | string): Promise<WeekBoundaryResult> {
    let targetDate: Date;
    if (!targetDateInput) {
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    } else if (typeof targetDateInput === 'string') {
      targetDate = this.parseDateOnly(targetDateInput);
    } else {
      targetDate = new Date(Date.UTC(targetDateInput.getFullYear(), targetDateInput.getMonth(), targetDateInput.getDate()));
    }

    // 1. Check if targetDate falls within any CustomWeekPeriod
    // Use end_date > targetDate (strictly greater) because end_date at 06:59 is the handoff morning
    // where the NEXT week cycle begins at 07:00.
    const custom = await this.prisma.customWeekPeriod.findFirst({
      where: {
        start_date: { lte: targetDate },
        end_date: { gt: targetDate },
      },
    });

    if (custom) {
      const startDateStr = this.formatDateOnly(custom.start_date);
      const endDateStr = this.formatDateOnly(custom.end_date);
      return {
        is_custom: true,
        custom_period_id: custom.id,
        name: custom.name,
        start_date: startDateStr,
        start_time: custom.start_time,
        end_date: endDateStr,
        end_time: custom.end_time,
        total_days: custom.total_days,
        label: `${custom.name ? `${custom.name}: ` : ''}${startDateStr} (${custom.start_time}) → ${endDateStr} (${custom.end_time}) [${custom.total_days} ngày]`,
      };
    }

    // 2. Otherwise find the effective WeekCycleRule
    const rule = await this.prisma.weekCycleRule.findFirst({
      where: {
        effective_date: { lte: targetDate },
      },
      orderBy: { effective_date: 'desc' },
    });

    const startDayOfWeek = rule ? rule.start_day_of_week : 1; // Default Monday
    const startTime = rule ? rule.start_time : '07:00';
    const endTime = rule ? rule.end_time : '06:59';

    // Calculate start date of week based on startDayOfWeek
    // In JS getUTCDay(): 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    const currentDayOfWeek = targetDate.getUTCDay();
    const dayDiff = (currentDayOfWeek - startDayOfWeek + 7) % 7;

    const startDate = new Date(targetDate);
    startDate.setUTCDate(startDate.getUTCDate() - dayDiff);

    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 7);

    const startDateStr = this.formatDateOnly(startDate);
    const endDateStr = this.formatDateOnly(endDate);

    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = dayNames[startDayOfWeek] || `Thứ ${startDayOfWeek + 1}`;

    return {
      is_custom: false,
      rule_id: rule?.id,
      start_day_of_week: startDayOfWeek,
      start_date: startDateStr,
      start_time: startTime,
      end_date: endDateStr,
      end_time: endTime,
      total_days: 7,
      label: `Chu kỳ ${dayName}: ${startDateStr} (${startTime}) → ${endDateStr} (${endTime}) [7 ngày]`,
    };
  }

  async getAll() {
    const rules = await this.prisma.weekCycleRule.findMany({
      orderBy: { effective_date: 'desc' },
    });
    const customPeriods = await this.prisma.customWeekPeriod.findMany({
      orderBy: { start_date: 'desc' },
    });
    const current = await this.getWeekBoundaries();

    // Inspect shift assignments from current.start_date onwards to determine
    // which dates are fully booked vs have remaining unscheduled hours
    const currentStartDate = this.parseDateOnly(current.start_date);
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        work_date: { gte: currentStartDate },
      },
      include: {
        shift: {
          select: { start_time: true, end_time: true },
        },
      },
    });

    const fullyBookedSet = new Set<string>();
    const minStartTimeByDate: Record<string, string> = {};

    const addOneMinute = (hhmm: string): string => {
      const [h, m] = hhmm.split(':').map(Number);
      const total = h * 60 + m + 1;
      const nh = Math.min(23, Math.floor(total / 60));
      const nm = total >= 24 * 60 ? 59 : total % 60;
      return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
    };

    for (const a of assignments) {
      if (!a.shift) continue;
      const dateStr = this.formatDateOnly(a.work_date);
      const st = a.shift.start_time || '00:00';
      const et = (a.shift.end_time || '').trim();

      const hasValidEnd = et.length > 0 && et.includes(':');
      const crossesMidnight = hasValidEnd && (et < st || et === '00:00');
      const isLateNightShift = st >= '22:00' || (hasValidEnd && et >= '23:00');

      // Day is fully booked if it has a late-night shift (>= 22:00) or a shift crossing midnight / ending >= 23:00
      if (isLateNightShift || crossesMidnight) {
        fullyBookedSet.add(dateStr);
        if (crossesMidnight && et > '00:00') {
          const nextD = new Date(a.work_date);
          nextD.setUTCDate(nextD.getUTCDate() + 1);
          const nextStr = this.formatDateOnly(nextD);
          const candidate = et === '06:59' ? '07:00' : et;
          if (!minStartTimeByDate[nextStr] || candidate > minStartTimeByDate[nextStr]) {
            minStartTimeByDate[nextStr] = candidate;
          }
        }
      } else {
        // Determine earliest free time after this shift:
        // If end_time is missing (e.g. Excel import), allow starting strictly after start_time (+1 minute).
        let candidate: string;
        if (hasValidEnd) {
          candidate = et === '06:59' ? '07:00' : et;
        } else {
          candidate = addOneMinute(st);
        }
        if (!minStartTimeByDate[dateStr] || candidate > minStartTimeByDate[dateStr]) {
          minStartTimeByDate[dateStr] = candidate;
        }
      }
    }

    const enrichedRules = await Promise.all(
      rules.map(async (r, idx) => {
        const isBase = idx === rules.length - 1;
        let canDelete = !isBase;
        let deleteBlockReason: string | null = isBase
          ? 'Đây là quy tắc mặc định gốc cuối cùng của hệ thống.'
          : null;

        if (!isBase) {
          const check = await this.checkRuleDeletable(r);
          canDelete = check.canDelete;
          deleteBlockReason = check.reason;
        }

        return {
          ...r,
          effective_date: this.formatDateOnly(r.effective_date),
          can_delete: canDelete,
          delete_block_reason: deleteBlockReason,
        };
      }),
    );

    const enrichedCustomPeriods = await Promise.all(
      customPeriods.map(async (c) => {
        const check = await this.checkCustomPeriodDeletable(c);
        return {
          ...c,
          start_date: this.formatDateOnly(c.start_date),
          end_date: this.formatDateOnly(c.end_date),
          can_delete: check.canDelete,
          delete_block_reason: check.reason,
        };
      }),
    );

    return {
      current,
      fully_booked_dates: Array.from(fullyBookedSet),
      min_start_time_by_date: minStartTimeByDate,
      rules: enrichedRules,
      custom_periods: enrichedCustomPeriods,
    };
  }

  private async checkCustomPeriodDeletable(period: {
    start_date: Date;
    start_time: string;
    end_date: Date;
    end_time: string;
  }): Promise<{ canDelete: boolean; reason: string | null }> {
    const isLocked =
      (await this.prisma.isDateLocked(period.start_date, period.start_time)) ||
      (await this.prisma.isPeriodOverlappingLocked(period.start_date, period.end_date));
    if (isLocked) {
      return {
        canDelete: false,
        reason: 'Chu kỳ này đã nằm trong kỳ lương đã chốt sổ (LockedPeriod). Không thể xóa.',
      };
    }

    const startStr = this.formatDateOnly(period.start_date);
    const endStr = this.formatDateOnly(period.end_date);

    // Check if any Shift was created for this week_start_date or any ShiftAssignment falls inside [start, end)
    const shiftCount = await this.prisma.shift.count({
      where: { week_start_date: period.start_date },
    });
    if (shiftCount > 0) {
      return {
        canDelete: false,
        reason: `Đã có ${shiftCount} ca làm việc thuộc chu kỳ này. Chỉ được xóa khi chưa có ca làm việc / phân công nào phát sinh.`,
      };
    }

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        work_date: {
          gte: period.start_date,
          lte: period.end_date,
        },
      },
      include: { shift: { select: { start_time: true } } },
    });

    const hasAssignmentInWindow = assignments.some((a) => {
      const dStr = this.formatDateOnly(a.work_date);
      const st = a.shift?.start_time || '00:00';
      const afterStart = dStr > startStr || (dStr === startStr && st >= (period.start_time || '07:00'));
      const beforeEnd = dStr < endStr || (dStr === endStr && st <= (period.end_time || '06:59'));
      return afterStart && beforeEnd;
    });

    if (hasAssignmentInWindow) {
      return {
        canDelete: false,
        reason: 'Đã có lịch phân công nhân sự phát sinh trong chu kỳ này. Chỉ được xóa khi chưa có ca làm việc / phân công nào.',
      };
    }

    return { canDelete: true, reason: null };
  }

  private async checkRuleDeletable(rule: {
    effective_date: Date;
    start_time: string;
  }): Promise<{ canDelete: boolean; reason: string | null }> {
    if (await this.prisma.isDateLocked(rule.effective_date, rule.start_time)) {
      return {
        canDelete: false,
        reason: 'Quy tắc chu kỳ này đã nằm trong kỳ lương đã chốt sổ (LockedPeriod). Không thể xóa.',
      };
    }

    const [shiftCount, assignmentCount] = await Promise.all([
      this.prisma.shift.count({
        where: { week_start_date: { gte: rule.effective_date } },
      }),
      this.prisma.shiftAssignment.count({
        where: { work_date: { gte: rule.effective_date } },
      }),
    ]);

    if (shiftCount > 0 || assignmentCount > 0) {
      return {
        canDelete: false,
        reason: 'Đã có ca làm việc / phân công nhân sự phát sinh từ ngày hiệu lực của quy tắc này. Chỉ được xóa khi chưa có dữ liệu ca trực.',
      };
    }

    return { canDelete: true, reason: null };
  }

  async setRule(
    data: {
      start_day_of_week: number;
      start_time?: string;
      end_time?: string;
      effective_date: string;
    },
    actorId?: string,
  ) {
    const effectiveDate = this.parseDateOnly(data.effective_date);

    // Validate that effective_date is not in a locked period
    if (await this.prisma.isDateLocked(effectiveDate, data.start_time || '07:00')) {
      throw new BadRequestException('Ngày hiệu lực này nằm trong kỳ lương đã bị chốt sổ. Không thể áp dụng.');
    }

    const startTime = data.start_time || '07:00';
    const endTime = data.end_time || '06:59';

    const rule = await this.prisma.weekCycleRule.upsert({
      where: { effective_date: effectiveDate },
      update: {
        start_day_of_week: data.start_day_of_week,
        start_time: startTime,
        end_time: endTime,
      },
      create: {
        start_day_of_week: data.start_day_of_week,
        start_time: startTime,
        end_time: endTime,
        effective_date: effectiveDate,
      },
    });

    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    await this.auditLogsService.log({
      actorId,
      page: 'DASHBOARD',
      action: 'UPDATE',
      entityType: 'WeekCycleRule',
      entityId: rule.id,
      summary: `Cập nhật quy tắc chu kỳ tuần: Bắt đầu lúc ${startTime} ${dayNames[data.start_day_of_week]}, áp dụng từ ngày ${data.effective_date}`,
      metadata: { ...data },
    });

    return rule;
  }

  async createCustomPeriod(
    data: {
      name?: string;
      start_date: string;
      start_time?: string;
      end_date: string;
      end_time?: string;
    },
    actorId?: string,
  ) {
    const startDate = this.parseDateOnly(data.start_date);
    const endDate = this.parseDateOnly(data.end_date);

    if (startDate >= endDate) {
      throw new BadRequestException('Ngày kết thúc phải lớn hơn ngày bắt đầu.');
    }

    const startTime = data.start_time || '07:00';
    const endTime = data.end_time || '06:59';

    // Validate locked periods
    if (await this.prisma.isDateLocked(startDate, startTime)) {
      throw new BadRequestException(`Ngày bắt đầu ${data.start_date} nằm trong kỳ lương đã chốt.`);
    }
    if (await this.prisma.isDateLocked(endDate, endTime)) {
      throw new BadRequestException(`Ngày kết thúc ${data.end_date} nằm trong kỳ lương đã chốt.`);
    }

    // Calculate total days
    const diffTime = endDate.getTime() - startDate.getTime();
    const totalDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const period = await this.prisma.customWeekPeriod.upsert({
      where: {
        start_date_end_date: {
          start_date: startDate,
          end_date: endDate,
        },
      },
      update: {
        name: data.name || null,
        start_time: startTime,
        end_time: endTime,
        total_days: totalDays,
      },
      create: {
        name: data.name || null,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        total_days: totalDays,
      },
    });

    await this.auditLogsService.log({
      actorId,
      page: 'DASHBOARD',
      action: 'CREATE',
      entityType: 'CustomWeekPeriod',
      entityId: period.id,
      summary: `Tạo tuần tùy chỉnh [${data.name || 'Không tên'}]: từ ${data.start_date} (${startTime}) đến ${data.end_date} (${endTime}) [${totalDays} ngày]`,
      metadata: { ...data, totalDays },
    });

    return period;
  }

  async deleteCustomPeriod(id: string, actorId?: string) {
    const period = await this.prisma.customWeekPeriod.findUnique({
      where: { id },
    });
    if (!period) {
      throw new NotFoundException('Không tìm thấy tuần tùy chỉnh này.');
    }

    const check = await this.checkCustomPeriodDeletable(period);
    if (!check.canDelete) {
      throw new BadRequestException(
        `${check.reason} (Điều kiện xóa: 1. Chưa chốt sổ bảng lương; 2. Chưa có ca làm việc / phân công nhân sự nào phát sinh trong chu kỳ này).`,
      );
    }

    await this.prisma.customWeekPeriod.delete({
      where: { id },
    });

    await this.auditLogsService.log({
      actorId,
      page: 'DASHBOARD',
      action: 'DELETE',
      entityType: 'CustomWeekPeriod',
      entityId: id,
      summary: `Xóa tuần tùy chỉnh [${period.name || id}]: ${this.formatDateOnly(period.start_date)} → ${this.formatDateOnly(period.end_date)}`,
    });

    return { success: true };
  }

  async deleteRule(id: string, actorId?: string) {
    const rule = await this.prisma.weekCycleRule.findUnique({
      where: { id },
    });
    if (!rule) {
      throw new NotFoundException('Không tìm thấy quy tắc chu kỳ này.');
    }

    const totalRules = await this.prisma.weekCycleRule.count();
    if (totalRules <= 1) {
      throw new BadRequestException('Không thể xóa quy tắc chu kỳ mặc định cuối cùng của hệ thống.');
    }

    const check = await this.checkRuleDeletable(rule);
    if (!check.canDelete) {
      throw new BadRequestException(
        `${check.reason} (Điều kiện xóa: 1. Chưa chốt sổ bảng lương; 2. Chưa có ca làm việc / phân công nhân sự nào phát sinh từ ngày hiệu lực).`,
      );
    }

    await this.prisma.weekCycleRule.delete({
      where: { id },
    });

    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    await this.auditLogsService.log({
      actorId,
      page: 'DASHBOARD',
      action: 'DELETE',
      entityType: 'WeekCycleRule',
      entityId: id,
      summary: `Xóa quy tắc chu kỳ tuần: ${dayNames[rule.start_day_of_week]} (hiệu lực từ ${this.formatDateOnly(rule.effective_date)})`,
    });

    return { success: true };
  }
}
