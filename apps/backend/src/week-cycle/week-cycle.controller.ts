import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { WeekCycleService } from './week-cycle.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('week-cycle')
export class WeekCycleController {
  constructor(private readonly weekCycleService: WeekCycleService) {}

  @Get('current')
  getCurrentBoundary(@Query('date') date?: string) {
    return this.weekCycleService.getWeekBoundaries(date);
  }

  @Get('all')
  getAll() {
    return this.weekCycleService.getAll();
  }

  @Get('config')
  getConfig() {
    return this.weekCycleService.getAll();
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('rule')
  setRule(
    @Request() req: any,
    @Body()
    data: {
      start_day_of_week: number;
      start_time?: string;
      end_time?: string;
      effective_date: string;
    },
  ) {
    return this.weekCycleService.setRule(data, req.user?.userId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('custom-period')
  createCustomPeriod(
    @Request() req: any,
    @Body()
    data: {
      name?: string;
      start_date: string;
      start_time?: string;
      end_date: string;
      end_time?: string;
    },
  ) {
    return this.weekCycleService.createCustomPeriod(data, req.user?.userId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete('custom-period/:id')
  deleteCustomPeriod(@Request() req: any, @Param('id') id: string) {
    return this.weekCycleService.deleteCustomPeriod(id, req.user?.userId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete('rule/:id')
  deleteRule(@Request() req: any, @Param('id') id: string) {
    return this.weekCycleService.deleteRule(id, req.user?.userId);
  }
}
