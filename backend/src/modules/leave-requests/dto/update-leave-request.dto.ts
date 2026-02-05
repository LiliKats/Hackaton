import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, IsString, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType, LeaveStatus } from '../entities/leave-request.entity';
import { CreateLeaveRequestDto } from './create-leave-request.dto';

@ValidatorConstraint({ name: 'canUpdateRequest', async: false })
class CanUpdateRequestConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    // This will be enhanced when we have access to the current request status
    // For now, we'll handle this in the service layer
    return true;
  }

  defaultMessage() {
    return 'Request cannot be updated in its current status';
  }
}

export class UpdateLeaveRequestDto extends PartialType(CreateLeaveRequestDto) {
  @ApiPropertyOptional({
    enum: LeaveType,
    description: 'Updated type of leave',
  })
  @IsEnum(LeaveType, { message: 'Invalid leave type' })
  @IsOptional()
  type?: LeaveType;

  @ApiPropertyOptional({
    description: 'Updated start date of the leave period',
    example: '2024-03-15',
  })
  @IsDateString({}, { message: 'Start date must be a valid date' })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Updated end date of the leave period',
    example: '2024-03-20',
  })
  @IsDateString({}, { message: 'End date must be a valid date' })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Updated reason for the leave request',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}