import {
    IsInt,
    IsNotEmpty,
    IsPositive,
    Min,
} from 'class-validator';

export class UpdateQuantityDto {
    @IsInt()
    @IsPositive()
    @Min(1)
    @IsNotEmpty()
    quantity!: number;
}