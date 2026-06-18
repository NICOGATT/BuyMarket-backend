import { Test, TestingModule } from '@nestjs/testing';
import { WalletTransactionController } from './wallet-transaction.controller';
import { WalletTransactionService } from './wallet-transaction.service';

describe('WalletTransactionController', () => {
  let controller: WalletTransactionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletTransactionController],
      providers: [WalletTransactionService],
    }).compile();

    controller = module.get<WalletTransactionController>(WalletTransactionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
