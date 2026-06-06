import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductDto {
    @IsString()
    @IsNotEmpty()
    title! : string;

    @IsString()
    @IsNotEmpty()
    description! : string;

    @IsNumber()
    @IsPositive()
    price! : number;

    @IsNumber()
    @Min(0)
    stock! : number;

    @IsString()
    category! : string;

    @IsString()
    @IsNotEmpty()
    direccionRetiro! : string;

    @IsString()
    @IsNotEmpty()
    horarioDisponible! : string;

    @IsOptional()
    @IsArray()
    images! : string[];

    @IsString()
    owner! : string;
}

