import { Module } from '@nestjs/common';
import { WithDrawalRequestService } from './with-drawal-request.service';
import { WithDrawalRequestController } from './with-drawal-request.controller';

@Module({
  controllers: [WithDrawalRequestController],
  providers: [WithDrawalRequestService],
})
export class WithDrawalRequestModule {}
