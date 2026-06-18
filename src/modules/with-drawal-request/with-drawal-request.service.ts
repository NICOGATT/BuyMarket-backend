import { Injectable } from '@nestjs/common';
import { CreateWithdrawalRequestDto } from './dto/create-with-drawal-request.dto';
import { UpdateWithDrawalRequestDto } from './dto/update-with-drawal-request.dto';

@Injectable()
export class WithDrawalRequestService {
  create(createWithDrawalRequestDto: CreateWithdrawalRequestDto) {
    return 'This action adds a new withDrawalRequest';
  }

  findAll() {
    return `This action returns all withDrawalRequest`;
  }

  findOne(id: number) {
    return `This action returns a #${id} withDrawalRequest`;
  }

  update(id: number, updateWithDrawalRequestDto: UpdateWithDrawalRequestDto) {
    return `This action updates a #${id} withDrawalRequest`;
  }

  remove(id: number) {
    return `This action removes a #${id} withDrawalRequest`;
  }
}
