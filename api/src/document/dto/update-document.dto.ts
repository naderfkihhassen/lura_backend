import { IsOptional, IsString, IsArray, IsNumber } from "class-validator"

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tagIds?: number[]
}
