import { IsString, IsNotEmpty, IsArray, IsOptional, IsBoolean, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskCommandDto {
  @IsNumber()
  @Min(0)
  order: number;

  @IsString()
  @IsNotEmpty()
  command: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  timeout?: number;
}

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskCommandDto)
  commands: CreateTaskCommandDto[];

  @IsBoolean()
  @IsOptional()
  stopOnError?: boolean;
}
