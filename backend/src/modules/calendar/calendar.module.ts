import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { LeaveRequestsModule } from '../leave-requests/leave-requests.module';

@Module({
  imports: [LeaveRequestsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
