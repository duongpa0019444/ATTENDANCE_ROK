import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PayrollService } from '../payroll/payroll.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly payrollService: PayrollService,
  ) { }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.debug('Scanning for upcoming shifts...');
    const now = new Date();

    // Query assignments within a ±1 day window to be timezone-robust
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        work_date: {
          gte: yesterday,
          lte: tomorrow,
        },
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
    });

    const reminderMinutes = parseInt(await this.prisma.getSetting('REMINDER_MINUTES', '10'), 10);
    const prepMinutes = parseInt(await this.prisma.getSetting('PREPARATION_MINUTES', '0'), 10);
    const unconfirmedWarningMinutes = parseInt(await this.prisma.getSetting('UNCONFIRMED_WARNING_MINUTES', '5'), 10);
    const checkinGraceMinutes = parseInt(await this.prisma.getSetting('CHECKIN_GRACE_MINUTES', '5'), 10);

    const totalReminderStart = reminderMinutes + prepMinutes;
    const totalReminderEnd = 1 + prepMinutes;
    const totalWarningMins = unconfirmedWarningMinutes + prepMinutes;

    this.logger.debug(`Found ${assignments.length} assignments in scan window. Config: reminder=${reminderMinutes}, prep=${prepMinutes}, warning=${unconfirmedWarningMinutes}, grace=${checkinGraceMinutes}`);

    for (const assignment of assignments) {
      if (!assignment.user.telegram_id) continue;

      const shiftDisplayName = assignment.shift.name
        ? `${assignment.shift.server?.name} (${assignment.shift.name})`
        : (assignment.shift.server?.name || 'N/A');

      // Get or create attendance log
      let log = assignment.attendance_logs[0];
      if (!log) {
        log = await this.prisma.attendanceLog.create({
          data: {
            user_id: assignment.user_id,
            shift_assignment_id: assignment.id,
            status: 'PENDING',
          },
        });
      }

      // Compute exact shift start time in local server timezone
      const workDate = new Date(assignment.work_date);
      const day = String(workDate.getUTCDate()).padStart(2, '0');
      const month = String(workDate.getUTCMonth() + 1).padStart(2, '0');
      const year = workDate.getUTCFullYear();
      const dateStr = `${day}/${month}/${year}`;

      const [hours, minutes] = assignment.shift.start_time.split(':').map(Number);
      const shiftStart = new Date(
        workDate.getUTCFullYear(),
        workDate.getUTCMonth(),
        workDate.getUTCDate(),
        hours,
        minutes,
        0
      );

      // Diff in minutes
      const diffMs = shiftStart.getTime() - now.getTime();
      const diffMins = Math.round(diffMs / 60000);

      // 1. Reminder window (from totalReminderStart down to totalReminderEnd, excluding warning time)
      if (diffMins >= totalReminderEnd && diffMins <= totalReminderStart && diffMins !== totalWarningMins) {
        if (log.status === 'PENDING') {
          await this.sendNotificationIfNew(
            assignment.user_id,
            `REMINDER_T${diffMins}`,
            assignment.id,
            {
              type: 'REMINDER_T10',
              chatId: assignment.user.telegram_id,
              data: {
                shiftName: shiftDisplayName,
                startTime: assignment.shift.start_time,
                endTime: assignment.shift.end_time,
                dateStr,
                assignmentId: assignment.id,
                minutesLeft: diffMins - prepMinutes,
              },
            }
          );
        }
      }

      // 2. T -warning (Escalation L1 to admin if employee did not confirm)
      if (diffMins === totalWarningMins) {
        if (log.status === 'PENDING') {
          // Escalation Level 1
          const existingEsc = await this.prisma.escalationLog.findFirst({
            where: { attendance_id: log.id, level: 1 },
          });
          if (!existingEsc) {
            await this.prisma.escalationLog.create({
              data: { attendance_id: log.id, level: 1 },
            });

            // Alert manager via Telegram
            const alertMsg = `⚠️ CẢNH BÁO: Nhân sự [${assignment.user.full_name}] chưa xác nhận ca làm [${shiftDisplayName}] ngày ${dateStr} (bắt đầu lúc ${assignment.shift.start_time}).`;
            await this.queueManagersNotification(alertMsg);

            // Realtime Socket warning event
            this.realtimeGateway.notifyDashboard('attendance-warning', {
              userId: assignment.user_id,
              name: assignment.user.full_name,
              serverName: assignment.shift.server?.name || assignment.shift.name || 'N/A',
              startTime: assignment.shift.start_time,
              dateStr,
            });
          }
        }
      }
    }
  }

  private async sendNotificationIfNew(userId: string, type: string, assignmentId: string, jobData: any): Promise<boolean> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        user_id: userId,
        type,
      },
    });

    const alreadySent = existing ? (existing.payload as any)?.assignmentId === assignmentId : false;

    if (!alreadySent) {
      await this.prisma.notification.create({
        data: {
          user_id: userId,
          channel: 'TELEGRAM',
          type,
          payload: { assignmentId },
          status: 'SENT',
          sent_at: new Date(),
        },
      });

      await this.queueService.addNotificationJob(jobData);
      return true;
    }

    return false;
  }

  private async queueManagersNotification(message: string) {
    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        telegram_id: { not: null },
      },
    });
    for (const mgr of managers) {
      if (mgr.telegram_id) {
        await this.queueService.addNotificationJob({
          type: 'TEXT',
          chatId: mgr.telegram_id,
          data: { message },
        });
      }
    }
  }

  /**
   * Auto-lock payroll for the previous week every Monday at 7:00 AM.
   * Locks the period from Monday 7:00 AM of previous week to Monday 6:59 AM of this week.
   */
  @Cron('0 7 * * 1') // Every Monday at 7:00 AM
  async handleAutoLockPayroll() {
    this.logger.log('⏰ Running auto-lock payroll for previous week...');

    const now = new Date();

    // Calculate previous Monday 7:00 AM
    const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysBackToPrevMon = currentDay === 0 ? 6 : currentDay - 1; // If Sun, go back 6 days to previous Mon
    const prevMonday = new Date(now);
    prevMonday.setDate(now.getDate() - 7 - daysBackToPrevMon); // Go back to previous Monday (7 days before this Monday)
    prevMonday.setHours(7, 0, 0, 0);

    // This Monday 7:00 AM
    const thisMonday = new Date(prevMonday);
    thisMonday.setDate(thisMonday.getDate() + 7);
    thisMonday.setHours(7, 0, 0, 0);

    const startDateStr = prevMonday.toISOString().split('T')[0];
    // End date is this Monday 6:59 AM -> use thisMonday's date minus 1 minute for end param
    const endDateObj = new Date(thisMonday);
    endDateObj.setMinutes(endDateObj.getMinutes() - 1);
    const endDateStr = endDateObj.toISOString().split('T')[0];

    this.logger.log(`📅 Auto-lock period: ${startDateStr} to ${endDateStr}`);

    try {
      // Check if already locked
      const lockStatus = await this.payrollService.getPeriodLockStatus(startDateStr, endDateStr);
      if (lockStatus.locked) {
        this.logger.log(`✅ Period ${startDateStr} to ${endDateStr} was already locked. Skipping.`);
        return;
      }

      // Lock the period
      const result = await this.payrollService.lockPeriod(startDateStr, endDateStr);
      if (result.success) {
        this.logger.log(`✅ Successfully auto-locked payroll for period ${startDateStr} to ${endDateStr}`);

        // Notify admins/managers via Telegram
        const message = `🔒 *TỰ ĐỘNG CHỐT BẢNG LƯƠNG*\n\nTuần từ *${startDateStr}* đến *${endDateStr}* đã được hệ thống tự động chốt.\n\nVào trang Payroll để xem chi tiết.`;
        await this.queueManagersNotification(message);

        // Notify via realtime socket
        this.realtimeGateway.notifyDashboard('payroll-locked', {
          startDate: startDateStr,
          endDate: endDateStr,
          autoLocked: true,
        });
      } else {
        this.logger.error(`❌ Auto-lock failed for period ${startDateStr} to ${endDateStr}: ${result.message}`);
      }
    } catch (err) {
      this.logger.error(`❌ Auto-lock payroll error: ${err.message}`, err.stack);
    }
  }
}
