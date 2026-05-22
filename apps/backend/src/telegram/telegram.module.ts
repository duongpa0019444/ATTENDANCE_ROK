import { Global, Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramLinkController } from './telegram-link.controller';

@Global()
@Module({
  controllers: [TelegramLinkController],
  providers: [TelegramService, TelegramLinkService],
  exports: [TelegramService, TelegramLinkService],
})
export class TelegramModule {}
