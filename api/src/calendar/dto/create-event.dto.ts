import { IsString, IsNotEmpty, IsOptional, IsDateString, IsBoolean, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReminderDto {
  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;

  @IsArray()
  @IsNumber({}, { each: true })
  times: number[];

  @IsBoolean()
  @IsNotEmpty()
  soundEnabled: boolean;

  @IsBoolean()
  @IsNotEmpty()
  emailEnabled: boolean;
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDateString()
  @IsNotEmpty()
  start: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReminderDto)
  reminders?: ReminderDto;
} 