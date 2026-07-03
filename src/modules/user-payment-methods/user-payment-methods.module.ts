import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/entity/user.entity';
import { UserPaymentMethod } from './entities/user-payment-method.entity';
import { UserPaymentMethodsController } from './user-payment-methods.controller';
import { UserPaymentMethodsService } from './user-payment-methods.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserPaymentMethod,
      User,
    ]),
  ],
  controllers: [UserPaymentMethodsController],
  providers: [UserPaymentMethodsService],
  exports: [UserPaymentMethodsService],
})
export class UserPaymentMethodsModule {}
