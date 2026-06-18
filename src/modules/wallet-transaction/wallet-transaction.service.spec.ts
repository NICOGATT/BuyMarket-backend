import { Test, TestingModule } from '@nestjs/testing';
import { WalletTransactionService } from './wallet-transaction.service';

describe('WalletTransactionService', () => {
  let service: WalletTransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletTransactionService],
    }).compile();

    service = module.get<WalletTransactionService>(WalletTransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
