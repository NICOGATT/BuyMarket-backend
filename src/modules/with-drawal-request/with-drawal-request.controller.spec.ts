import { Test, TestingModule } from '@nestjs/testing';
import { WithDrawalRequestController } from './with-drawal-request.controller';
import { WithDrawalRequestService } from './with-drawal-request.service';

describe('WithDrawalRequestController', () => {
  let controller: WithDrawalRequestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WithDrawalRequestController],
      providers: [WithDrawalRequestService],
    }).compile();

    controller = module.get<WithDrawalRequestController>(WithDrawalRequestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
