import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  async getPayroll(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error('Missing start_date or end_date');
    }
    return this.payrollService.calculatePayroll(startDate, endDate);
  }

  @Get('my-payroll')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  async getMyPayroll(
    @Request() req: any,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error('Missing start_date or end_date');
    }
    const result = await this.payrollService.calculatePayroll(startDate, endDate, req.user.userId);
    return result[0] || null;
  }

  @Get('settings')
  async getSettings() {
    return this.payrollService.getSettings();
  }

  @Post('settings')
  async updateSettings(
    @Body()
    body: {
      nightShift22_3Bonus?: number;
      nightShift3_7Bonus?: number;
      weekendBonus?: number;
      defaultServerSalary?: number;
    },
  ) {
    return this.payrollService.updateSettings(body);
  }

  @Get('allowances')
  async getAllowances(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.payrollService.getAllowances(startDate, endDate);
  }

  @Post('allowances')
  async createAllowance(
    @Body()
    body: {
      work_date: string;
      amount: number;
      note?: string;
    },
  ) {
    return this.payrollService.upsertAllowance(body);
  }

  @Put('allowances/:id')
  async updateAllowance(
    @Param('id') id: string,
    @Body()
    body: {
      work_date: string;
      amount: number;
      note?: string;
    },
  ) {
    return this.payrollService.updateAllowance(id, body);
  }

  @Delete('allowances/:id')
  async deleteAllowance(@Param('id') id: string) {
    return this.payrollService.deleteAllowance(id);
  }

  @Get('lock-status')
  async getLockStatus(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error('Missing start_date or end_date');
    }
    return this.payrollService.getPeriodLockStatus(startDate, endDate);
  }

  @Post('lock')
  async lockPeriod(
    @Body()
    body: {
      start_date: string;
      end_date: string;
    },
  ) {
    if (!body.start_date || !body.end_date) {
      throw new Error('Missing start_date or end_date');
    }
    return this.payrollService.lockPeriod(body.start_date, body.end_date);
  }

  @Post('unlock')
  async unlockPeriod(
    @Body()
    body: {
      start_date: string;
      end_date: string;
    },
  ) {
    if (!body.start_date || !body.end_date) {
      throw new Error('Missing start_date or end_date');
    }
    return this.payrollService.unlockPeriod(body.start_date, body.end_date);
  }

  @Get('shift-bonuses')
  async getShiftDayBonuses(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.payrollService.getShiftDayBonuses(startDate, endDate);
  }

  @Post('shift-bonuses')
  async upsertShiftDayBonus(
    @Body()
    body: {
      shift_id: string;
      work_date: string;
      amount: number;
    },
  ) {
    return this.payrollService.upsertShiftDayBonus(body);
  }

  @Delete('shift-bonuses/:id')
  async deleteShiftDayBonus(@Param('id') id: string) {
    return this.payrollService.deleteShiftDayBonus(id);
  }

  @Get('server-salaries')
  async getServerWeekSalaries(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error('Missing start_date or end_date');
    }
    return this.payrollService.getServerWeekSalaries(startDate, endDate);
  }

  @Post('server-salaries')
  async upsertServerWeekSalary(
    @Body()
    body: {
      server_id: string;
      start_date: string;
      end_date: string;
      base_salary: number;
    },
  ) {
    if (!body.server_id || !body.start_date || !body.end_date || body.base_salary === undefined) {
      throw new Error('Missing required fields');
    }
    return this.payrollService.upsertServerWeekSalary(body);
  }

  @Delete('server-salaries/:id')
  async deleteServerWeekSalary(@Param('id') id: string) {
    return this.payrollService.deleteServerWeekSalary(id);
  }
}

