import { ApiProperty } from '@nestjs/swagger';

export class LeaveBalanceDto {
  @ApiProperty({
    description: 'Total annual leave days allocated',
    example: 20,
  })
  totalAnnualLeave: number;

  @ApiProperty({
    description: 'Annual leave days used',
    example: 8,
  })
  usedAnnualLeave: number;

  @ApiProperty({
    description: 'Remaining annual leave days',
    example: 12,
  })
  remainingAnnualLeave: number;

  @ApiProperty({
    description: 'Pending annual leave days (not yet approved)',
    example: 3,
  })
  pendingAnnualLeave: number;

  @ApiProperty({
    description: 'Available annual leave days (after pending)',
    example: 9,
  })
  availableAnnualLeave: number;

  @ApiProperty({
    description: 'Total sick leave days taken this year',
    example: 2,
  })
  sickLeaveTaken: number;

  @ApiProperty({
    description: 'Other leave types taken',
    example: 1,
  })
  otherLeaveTaken: number;
}

export class TeamLeaveCalendarDto {
  @ApiProperty({
    description: 'User ID',
  })
  userId: string;

  @ApiProperty({
    description: 'User full name',
  })
  userName: string;

  @ApiProperty({
    description: 'Leave start date',
  })
  startDate: Date;

  @ApiProperty({
    description: 'Leave end date',
  })
  endDate: Date;

  @ApiProperty({
    description: 'Leave type',
    enum: ['annual', 'sick', 'personal', 'unpaid', 'maternity', 'paternity', 'other'],
  })
  type: string;

  @ApiProperty({
    description: 'Total days for this leave',
  })
  totalDays: number;
}