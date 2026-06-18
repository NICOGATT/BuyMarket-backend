import { Test, TestingModule } from '@nestjs/testing';
import { WithDrawalRequestService } from './with-drawal-request.service';

describe('WithDrawalRequestService', () => {
  let service: WithDrawalRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WithDrawalRequestService],
    }).compile();

    service = module.get<WithDrawalRequestService>(WithDrawalRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
