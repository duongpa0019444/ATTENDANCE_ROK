import { Controller, Get, Post, Body } from '@nestjs/common';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  findAllShifts() {
    return this.shiftsService.findAllShifts();
  }

  @Post()
  createShift(@Body() data: any) {
    return this.shiftsService.createShift(data);
  }

  @Get('assignments')
  getAssignments() {
    return this.shiftsService.getAssignments();
  }

  @Post('assign')
  assignShift(@Body() data: any) {
    return this.shiftsService.assignShift(data);
  }
}
