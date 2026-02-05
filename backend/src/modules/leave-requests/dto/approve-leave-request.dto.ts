import { IsString, IsOptional, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveLeaveRequestDto {
  @ApiPropertyOptional({
    description: 'Comments from the approver',
    example: 'Approved for vacation period',
  })
  @IsString()
  @IsOptional()
  approvalComments?: string;
}

export class RejectLeaveRequestDto {
  @ApiProperty({
    description: 'Reason for rejecting the leave request',
    example: 'Team coverage requirements not met during this period',
  })
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  rejectionReason: string;

  @ApiPropertyOptional({
    description: 'Whether to suggest alternative dates',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  suggestAlternatives?: boolean;
}

export class BulkApprovalDto {
  @ApiProperty({
    description: 'Array of leave request IDs to approve',
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  requestIds: string[];

  @ApiPropertyOptional({
    description: 'Comments for all approved requests',
  })
  @IsString()
  @IsOptional()
  comments?: string;
}