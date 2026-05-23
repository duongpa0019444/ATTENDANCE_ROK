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

    this.logger.debug(`Found ${assignments.length} assignments in scan window.`);

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

      // 1. T-10 to T-1 mins (Remind every minute if still PENDING, excluding T-5 warning)
      if (diffMins >= 1 && diffMins <= 10 && diffMins !== 5) {
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
                minutesLeft: diffMins,
              },
            }
          );
        }
      }

      // 2. T -5 (Warning & Escalation L1)
      if (diffMins === 5) {
        if (log.status === 'PENDING') {
          // Warning to staff
          await this.sendNotificationIfNew(
            assignment.user_id,
            'WARNING_T5',
            assignment.id,
            {
              type: 'WARNING_T5',
              chatId: assignment.user.telegram_id,
              data: {
                startTime: assignment.shift.start_time,
                dateStr,
                assignmentId: assignment.id,
              },
            }
          );

          // Escalation Level 1
          const existingEsc = await this.prisma.escalationLog.findFirst({
            where: { attendance_id: log.id, level: 1 },
          });
          if (!existingEsc) {
            await this.prisma.escalationLog.create({
              data: { attendance_id: log.id, level: 1 },
            });

            // Alert manager via Telegram
            const alertMsg = `⚠️ CẢNH BÁO LEVEL 1: Nhân sự [${assignment.user.full_name}] chưa xác nhận ca làm [${shiftDisplayName}] ngày ${dateStr} (bắt đầu lúc ${assignment.shift.start_time}).`;
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

      // 3. T +0 (Check-in Prompt)
      if (diffMins === 0) {
        if (['PENDING', 'READY'].includes(log.status)) {
          await this.sendNotificationIfNew(
            assignment.user_id,
            'CHECKIN_T0',
            assignment.id,
            {
              type: 'CHECKIN_T0',
              chatId: assignment.user.telegram_id,
              data: {
                assignmentId: assignment.id,
              },
            }
          );
        }
      }

      // 4. T +5 (Late Logged & Escalation L2)
      // 4. Tardiness & Escalation L2 check
      let shouldTriggerLate = false;
      let lateMinutes = 5;

      if (diffMins === -5) {
        if (!['CHECKED_IN', 'ABSENT', 'ABSENT_REQUESTED', 'LATE'].includes(log.status)) {
          shouldTriggerLate = true;
          lateMinutes = 5;
        }
      }

      if (shouldTriggerLate) {
        if (!['CHECKED_IN', 'ABSENT', 'ABSENT_REQUESTED'].includes(log.status)) {
          const sent = await this.sendNotificationIfNew(
            assignment.user_id,
            `LATE_T${Math.abs(diffMins)}`,
            assignment.id,
            {
              type: 'TEXT',
              chatId: assignment.user.telegram_id,
              data: {
                message: `❌ Bạn đã bị ghi nhận đi trễ cho ca [${shiftDisplayName}] ngày ${dateStr}.`,
              },
            }
          );

          if (sent) {
            // Update DB Status to LATE
            if (log.status !== 'LATE') {
              await this.prisma.attendanceLog.update({
                where: { id: log.id },
                data: {
                  status: 'LATE',
                  late_minutes: lateMinutes,
                },
              });

              // Emit update socket
              this.realtimeGateway.notifyDashboard('attendance-updated', {
                id: log.id,
                userId: assignment.user_id,
                name: assignment.user.full_name,
                shift: `${shiftDisplayName} (${assignment.shift.start_time}${assignment.shift.end_time ? ` - ${assignment.shift.end_time}` : ''})`,
                status: 'LATE',
              });
            }

            // Escalation Level 2
            const existingEsc = await this.prisma.escalationLog.findFirst({
              where: { attendance_id: log.id, level: 2 },
            });
            if (!existingEsc) {
              await this.prisma.escalationLog.create({
                data: { attendance_id: log.id, level: 2 },
              });

              // Send Late alerts to managers
              await this.queueManagersLateAlert(
                assignment.user.full_name,
                assignment.shift.start_time,
                assignment.id,
                lateMinutes,
                dateStr
              );

              // Realtime Socket late event
              this.realtimeGateway.notifyDashboard('attendance-late', {
                userId: assignment.user_id,
                name: assignment.user.full_name,
                shift: shiftDisplayName,
                level: 2,
              });
            }
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

  private async queueManagersLateAlert(staffName: string, startTime: string, assignmentId: string, lateMinutes: number, dateStr: string) {
    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        telegram_id: { not: null },
      },
    });
    for (const mgr of managers) {
      if (mgr.telegram_id) {
        await this.queueService.addNotificationJob({
          type: 'LATE_T5_ALERT',
          chatId: mgr.telegram_id,
          data: {
            staffName,
            startTime,
            assignmentId,
            lateMinutes,
            dateStr,
          },
        });
      }
    }
  }
}
