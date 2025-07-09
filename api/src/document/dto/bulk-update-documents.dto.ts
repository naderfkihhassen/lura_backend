/* eslint-disable prettier/prettier */
import { IsArray, IsNumber, ArrayMinSize } from 'class-validator';

export class BulkUpdateDocumentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  documentIds: number[];

  @IsArray()
  @IsNumber({}, { each: true })
  tagIds: number[];
}
