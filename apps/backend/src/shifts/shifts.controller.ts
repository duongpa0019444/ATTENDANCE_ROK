import { Controller, Get, Post, Body, Put, Delete, Param, UseGuards, Query, Request } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportExcelDto } from './import-excel.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  findAllShifts(@Query('week_start_date') weekStartDate?: string) {
    return this.shiftsService.findAllShifts(weekStartDate);
  }

  @Post('clone-week')
  cloneWeek(@Body() body: { from_week: string; to_week: string }) {
    return this.shiftsService.cloneWeek(body.from_week, body.to_week);
  }

  @Post('import-excel')
  importExcel(@Body() dto: ImportExcelDto) {
    return this.shiftsService.importExcel(dto);
  }

  @Post()
  createShift(@Body() data: any) {
    return this.shiftsService.createShift(data);
  }

  @Put(':id')
  updateShift(@Param('id') id: string, @Body() data: any) {
    return this.shiftsService.updateShift(id, data);
  }

  @Delete(':id')
  removeShift(@Param('id') id: string) {
    return this.shiftsService.removeShift(id);
  }

  @Get('assignments')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  getAssignments(@Query() query?: any) {
    return this.shiftsService.getAssignments(query);
  }

  @Get('my-assignments')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  getMyAssignments(
    @Request() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.shiftsService.getAssignments({
      start_date: startDate,
      end_date: endDate,
      user_id: req.user.userId,
    });
  }

  @Post('sync-assignments')
  syncAssignments(@Body() data: { shift_id: string; work_date: string; user_ids: string[] }) {
    return this.shiftsService.syncAssignments(data);
  }

  @Post('assign')
  assignShift(@Body() data: any) {
    return this.shiftsService.assignShift(data);
  }

  @Put('assignments/:id')
  updateAssignment(@Param('id') id: string, @Body() data: any) {
    return this.shiftsService.updateAssignment(id, data);
  }

  @Get('weekly-config')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  getWeeklyConfig(@Query('week_start_date') weekStartDate: string) {
    return this.shiftsService.getWeeklyConfig(weekStartDate);
  }

  @Post('weekly-config')
  saveWeeklyConfig(@Body() body: { week_start_date: string; day_start_time: string }) {
    return this.shiftsService.saveWeeklyConfig(body.week_start_date, body.day_start_time);
  }

  @Delete('assignments/:id')
  removeAssignment(@Param('id') id: string) {
    return this.shiftsService.removeAssignment(id);
  }
}
