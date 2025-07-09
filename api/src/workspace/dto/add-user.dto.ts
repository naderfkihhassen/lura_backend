/* eslint-disable prettier/prettier */
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class AddUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}
