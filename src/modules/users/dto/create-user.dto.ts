import {IsEmail, IsNotEmpty, IsOptional,IsString,Min,MinLength} from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    firstName! : string;
    
    @IsString()
    @IsNotEmpty()
    lastName! : string; 

    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(6)
    password! : string ; 

    @IsOptional()
    @IsString()
    dni? : string; 

    @IsOptional()
    @IsString()
    avatar?: string; 
}
