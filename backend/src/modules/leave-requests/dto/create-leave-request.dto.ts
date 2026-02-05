import { IsEnum, IsNotEmpty, IsDateString, IsString, IsOptional, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '../entities/leave-request.entity';

@ValidatorConstraint({ name: 'isDateAfter', async: false })
class IsDateAfterConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)[relatedPropertyName];

    if (!value || !relatedValue) return false;

    return new Date(value) > new Date(relatedValue);
  }

  defaultMessage(args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    return `End date must be after ${relatedPropertyName}`;
  }
}

@ValidatorConstraint({ name: 'isMinimumNotice', async: false })
class IsMinimumNoticeConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) return false;

    const startDate = new Date(value);
    const today = new Date();
    const diffTime = startDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Minimum 2 weeks (14 days) notice for annual leave
    const leaveType = (args.object as any).type;
    if (leaveType === LeaveType.ANNUAL) {
      return diffDays >= 14;
    }

    // Immediate for sick leave, 1 day notice for others
    return leaveType === LeaveType.SICK || diffDays >= 1;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Insufficient notice period for this leave type';
  }
}

@ValidatorConstraint({ name: 'isMaximumDuration', async: false })
class IsMaximumDurationConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const startDate = new Date((args.object as any).startDate);
    const endDate = new Date(value);

    if (!startDate || !endDate) return false;

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Maximum 21 consecutive days for annual leave
    const leaveType = (args.object as any).type;
    if (leaveType === LeaveType.ANNUAL) {
      return diffDays <= 21;
    }

    return true; // No limit for other types
  }

  defaultMessage() {
    return 'Maximum consecutive leave period is 21 days';
  }
}

export class CreateLeaveRequestDto {
  @ApiProperty({
    enum: LeaveType,
    description: 'Type of leave being requested',
    example: LeaveType.ANNUAL,
  })
  @IsEnum(LeaveType, { message: 'Invalid leave type' })
  @IsNotEmpty()
  type: LeaveType;

  @ApiProperty({
    description: 'Start date of the leave period',
    example: '2024-03-15',
  })
  @IsDateString({}, { message: 'Start date must be a valid date' })
  @IsNotEmpty()
  @Validate(IsMinimumNoticeConstraint)
  @Transform(({ value }) => new Date(value))
  startDate: Date;

  @ApiProperty({
    description: 'End date of the leave period',
    example: '2024-03-20',
  })
  @IsDateString({}, { message: 'End date must be a valid date' })
  @IsNotEmpty()
  @Validate(IsDateAfterConstraint, ['startDate'])
  @Validate(IsMaximumDurationConstraint)
  @Transform(({ value }) => new Date(value))
  endDate: Date;

  @ApiPropertyOptional({
    description: 'Reason for the leave request',
    example: 'Family vacation',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}