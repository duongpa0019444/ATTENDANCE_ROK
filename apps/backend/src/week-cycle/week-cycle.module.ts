import { Module } from '@nestjs/common';
import { WeekCycleService } from './week-cycle.service';
import { WeekCycleController } from './week-cycle.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [WeekCycleController],
  providers: [WeekCycleService],
  exports: [WeekCycleService],
})
export class WeekCycleModule {}
