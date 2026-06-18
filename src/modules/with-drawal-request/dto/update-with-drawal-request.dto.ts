import { PartialType } from '@nestjs/mapped-types';
import { CreateWithdrawalRequestDto } from './create-with-drawal-request.dto';

export class UpdateWithDrawalRequestDto extends PartialType(CreateWithdrawalRequestDto) {}
