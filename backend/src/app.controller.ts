import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('workflows/my-pending-approvals')
  @ApiOperation({ summary: 'Mock pending approvals endpoint' })
  getMyPendingApprovals() {
    return {
      success: true,
      message: 'Backend is running successfully!',
      data: [
        {
          stepId: 'mock-step-1',
          workflowInstanceId: 'mock-workflow-1',
          requestorName: 'John Doe',
          requestorEmail: 'john.doe@company.com',
          leaveType: 'annual',
          startDate: '2026-05-15T00:00:00.000Z',
          endDate: '2026-05-22T00:00:00.000Z',
          totalDays: 8,
          reason: 'Family vacation to Italy',
          priority: 'high',
          currentStep: 'Manager Approval'
        }
      ],
      note: 'This is a mock response as the database is not connected yet.'
    };
  }
}
