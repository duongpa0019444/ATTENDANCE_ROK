import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TelegramService } from '../telegram/telegram.service';
import { Logger } from '@nestjs/common';

@Processor('notification-queue')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private telegramService: TelegramService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    const { type, chatId, data } = job.data;
    
    switch (type) {
      case 'REMINDER_T10':
        await this.telegramService.sendT10Reminder(
          chatId,
          data.shiftName,
          data.startTime,
          data.endTime,
          data.assignmentId,
          data.minutesLeft
        );
        break;
      case 'WARNING_T5':
        await this.telegramService.sendT5Warning(
          chatId,
          data.startTime,
          data.assignmentId
        );
        break;
      case 'CHECKIN_T0':
        await this.telegramService.sendT0Checkin(
          chatId,
          data.assignmentId
        );
        break;
      case 'LATE_T5_ALERT':
        await this.telegramService.sendLateT5Alert(
          chatId,
          data.staffName,
          data.startTime,
          data.assignmentId
        );
        break;
      case 'TEXT':
        await this.telegramService.sendMessage(chatId, data.message);
        break;
      default:
        // Handle legacy jobs or raw payload
        if (job.data.message) {
          await this.telegramService.sendMessage(chatId, job.data.message);
        } else if (type === 'REMINDER') {
          await this.telegramService.sendReminder(chatId, data.shiftName, data.assignmentId, data.minutesLeft || 10);
        } else {
          this.logger.warn(`Unknown job type: ${type}`);
        }
    }
  }
}
