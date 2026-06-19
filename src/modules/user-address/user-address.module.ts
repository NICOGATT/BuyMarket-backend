import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserAddress } from './entities/user-address.entity';
import { User } from '../users/entity/user.entity';

import { UserAddressesController } from './user-address.controller';
import { UserAddressesService } from './user-address.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserAddress,
      User,
    ]),
  ],
  controllers: [UserAddressesController],
  providers: [UserAddressesService],
  exports: [UserAddressesService],
})
export class UserAddressesModule {}
