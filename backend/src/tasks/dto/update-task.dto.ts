import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTaskCommandDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsNumber()
  @Min(0)
  order: number;

  @IsString()
  command: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  timeout?: number;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateTaskCommandDto)
  @IsOptional()
  commands?: UpdateTaskCommandDto[];

  @IsBoolean()
  @IsOptional()
  stopOnError?: boolean;
}
