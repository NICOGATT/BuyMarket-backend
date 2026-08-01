import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class CreateBrandDto {
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string | null;
}
