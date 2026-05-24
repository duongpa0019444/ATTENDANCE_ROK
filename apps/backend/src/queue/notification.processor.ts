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
          data.minutesLeft,
          data.dateStr
        );
        break;
      case 'TEXT':
        await this.telegramService.sendMessage(chatId, data.message);
        break;
      default:
        this.logger.warn(`Unknown or disabled job type: ${type}`);
    }
  }
}
