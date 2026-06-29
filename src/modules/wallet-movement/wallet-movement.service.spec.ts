import { Test, TestingModule } from '@nestjs/testing';
import { WalletMovementService } from './wallet-movement.service';

describe('WalletMovementService', () => {
  let service: WalletMovementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletMovementService],
    }).compile();

    service = module.get<WalletMovementService>(WalletMovementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
