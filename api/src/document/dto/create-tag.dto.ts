/* eslint-disable prettier/prettier */
import { IsNotEmpty, IsString, IsHexColor } from 'class-validator';

export class CreateTagDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsHexColor()
  color: string;
}
