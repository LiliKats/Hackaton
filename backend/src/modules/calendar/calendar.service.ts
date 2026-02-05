import { Injectable } from '@nestjs/common';
import { LeaveRequestsService } from '../leave-requests/leave-requests.service';

@Injectable()
export class CalendarService {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  async getCalendarEvents(startDate: Date, endDate: Date) {
    const leaveRequests = await this.leaveRequestsService.findByDateRange(startDate, endDate);

    return leaveRequests.map((request) => ({
      id: request.id,
      title: `${request.user.firstName} ${request.user.lastName} - ${request.type}`,
      start: request.startDate,
      end: request.endDate,
      userId: request.user.id,
      type: request.type,
    }));
  }
}
