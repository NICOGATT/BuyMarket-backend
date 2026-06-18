import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { WithDrawalRequestService } from './with-drawal-request.service';
import { CreateWithdrawalRequestDto } from './dto/create-with-drawal-request.dto';
import { UpdateWithDrawalRequestDto } from './dto/update-with-drawal-request.dto';

@Controller('with-drawal-request')
export class WithDrawalRequestController {
  constructor(private readonly withDrawalRequestService: WithDrawalRequestService) {}

  @Post()
  create(@Body() createWithDrawalRequestDto: CreateWithdrawalRequestDto) {
    return this.withDrawalRequestService.create(createWithDrawalRequestDto);
  }

  @Get()
  findAll() {
    return this.withDrawalRequestService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.withDrawalRequestService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWithDrawalRequestDto: UpdateWithDrawalRequestDto) {
    return this.withDrawalRequestService.update(+id, updateWithDrawalRequestDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.withDrawalRequestService.remove(+id);
  }
}
