import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (token && token !== 'your_telegram_bot_token_here') {
      this.bot = new Telegraf(token);
      
      this.bot.start((ctx) => ctx.reply('Welcome to Attendance Bot! Vui lòng cung cấp Username của bạn để liên kết tài khoản.'));
      
      this.bot.action(/confirm_shift_(.+)/, async (ctx) => {
        const shiftAssignmentId = ctx.match[1];
        // TODO: Update attendance log status to CONFIRMED
        await ctx.reply(`✅ Đã xác nhận ca làm thành công! ID: ${shiftAssignmentId}`);
        await ctx.answerCbQuery();
      });

      this.bot.action(/late_shift_(.+)/, async (ctx) => {
        const shiftAssignmentId = ctx.match[1];
        // TODO: Handle late request
        await ctx.reply(`⚠️ Đã ghi nhận xin đi trễ cho ca: ${shiftAssignmentId}. Quản lý sẽ được thông báo.`);
        await ctx.answerCbQuery();
      });
      
      this.bot.launch();
      this.logger.log('Telegram Bot started');
    } else {
      this.logger.warn('Telegram Bot Token is missing or invalid. Bot is not started.');
    }
  }

  async sendReminder(chatId: string, shiftName: string, assignmentId: string, minutesLeft: number) {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(
        chatId, 
        `🔔 Nhắc nhở: Còn ${minutesLeft} phút nữa là tới ca làm [${shiftName}]. Vui lòng chuẩn bị!`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Xác nhận chuẩn bị', `confirm_shift_${assignmentId}`),
          Markup.button.callback('⚠️ Xin đi trễ', `late_shift_${assignmentId}`)
        ])
      );
    } catch (error) {
      this.logger.error(`Error sending telegram message to ${chatId}`, error);
    }
  }

  async sendEscalation(chatId: string, message: string) {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(chatId, `🚨 CẢNH BÁO: ${message}`);
    } catch (error) {
      this.logger.error(`Error sending telegram message to ${chatId}`, error);
    }
  }

  async sendMessage(chatId: string, message: string) {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(chatId, message);
    } catch (error) {
      this.logger.error(`Error sending telegram message to ${chatId}`, error);
    }
  }
}
