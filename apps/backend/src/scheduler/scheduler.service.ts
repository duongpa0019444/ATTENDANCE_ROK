import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly realtimeGateway: RealtimeGateway,
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
              shift: shiftDisplayName,
              level: 1,
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
}
