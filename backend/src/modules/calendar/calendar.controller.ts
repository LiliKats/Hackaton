import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';

@ApiTags('Calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  @ApiOperation({ summary: 'Get calendar events' })
  getEvents(@Query('start') start: string, @Query('end') end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return this.calendarService.getCalendarEvents(startDate, endDate);
  }
}
