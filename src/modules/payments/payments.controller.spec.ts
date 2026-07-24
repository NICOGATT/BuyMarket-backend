import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { GetnetQrService } from './getnet-qr.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            createMercadoPagoPreference: jest.fn(),
            handleMercadoPagoWebhook: jest.fn(),
            createGetnetOrder: jest.fn(),
            handleGetnetWebhook: jest.fn(),
            notifyTransferPayment: jest.fn(),
            updateTransferPaymentStatus: jest.fn(),
          },
        },
        {
          provide: GetnetQrService,
          useValue: {
            getCapabilities: jest.fn(),
            createPayment: jest.fn(),
            handleWebhook: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
