import { Test, TestingModule } from '@nestjs/testing';
import { WalletMovementController } from './wallet-movement.controller';
import { WalletMovementService } from './wallet-movement.service';

describe('WalletMovementController', () => {
  let controller: WalletMovementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletMovementController],
      providers: [WalletMovementService],
    }).compile();

    controller = module.get<WalletMovementController>(WalletMovementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
