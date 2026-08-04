import { Transform, TransformFnParams } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class RecommendColorDto {
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : (value as unknown),
  )
  @IsString()
  @Matches(/^#[0-9A-F]{6}$/, {
    message: 'hex debe tener el formato #RRGGBB',
  })
  hex!: string;
}
