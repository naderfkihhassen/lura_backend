/* eslint-disable prettier/prettier */
import { IsEnum, IsOptional, IsString, IsArray, IsNumber } from 'class-validator';
import { CasePriority, CaseStatus } from '@prisma/client';

export class UpdateCaseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tagIds?: number[];
}
