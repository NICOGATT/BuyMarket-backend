import {IsEmail, IsNotEmpty, IsString, Min, MinLength} from 'class-validator';

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    name! : string; 
    
    @IsEmail()
    email! :string

    @MinLength(6)
    password! : string

}