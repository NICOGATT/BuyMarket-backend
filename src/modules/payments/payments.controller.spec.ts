import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { GetnetQrService } from './getnet-qr.service';
import { PaymentStatus } from './entity/payment.entity';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let app: INestApplication;
  let paymentsService: {
    updateManualPaymentStatus: jest.Mock;
    handleGetnetWebhook: jest.Mock;
  };

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
            updateManualPaymentStatus: jest.fn(),
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
    paymentsService = module.get(PaymentsService);
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delega la aprobacion de pagos manuales al servicio', async () => {
    const response = {
      orderId: 'order-1',
      orderStatus: 'paid',
      paymentStatus: PaymentStatus.COMPLETED,
    };
    paymentsService.updateManualPaymentStatus.mockResolvedValue(response);

    await expect(
      controller.updateManualPaymentStatus('order-1', {
        status: PaymentStatus.COMPLETED,
      }),
    ).resolves.toBe(response);
    expect(paymentsService.updateManualPaymentStatus).toHaveBeenCalledWith(
      'order-1',
      { status: PaymentStatus.COMPLETED },
    );
  });

  it('responde 204 sin cuerpo al webhook de Getnet', async () => {
    paymentsService.handleGetnetWebhook.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/payments/getnet/webhook')
      .set('Authorization', 'Basic valid')
      .send({ order_id: 'order-1' })
      .expect(204)
      .expect('');

    expect(paymentsService.handleGetnetWebhook).toHaveBeenCalledWith(
      'Basic valid',
      { order_id: 'order-1' },
    );
  });

  it('responde 401 si el servicio rechaza la autenticacion del webhook', async () => {
    paymentsService.handleGetnetWebhook.mockRejectedValue(
      new UnauthorizedException('Credenciales de webhook invalidas'),
    );

    await request(app.getHttpServer())
      .post('/payments/getnet/webhook')
      .send({ order_id: 'order-1' })
      .expect(401);
  });
});
