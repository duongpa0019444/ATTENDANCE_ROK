import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TelegramModule } from './telegram/telegram.module';
import { RealtimeModule } from './realtime/realtime.module';
import { QueueModule } from './queue/queue.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { UsersModule } from './users/users.module';
import { ShiftsModule } from './shifts/shifts.module';
import { AuthModule } from './auth/auth.module';
import { ServersModule } from './servers/servers.module';
import { PayrollModule } from './payroll/payroll.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env', // Root .env path
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    TelegramModule,
    RealtimeModule,
    QueueModule,
    SchedulerModule,
    UsersModule,
    ShiftsModule,
    AuthModule,
    ServersModule,
    PayrollModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
