import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment as MercadoPagoPayment, Preference } from 'mercadopago';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from '../orders/entities/order.entity';
import { WalletService } from '../wallet/wallet.service';
import { Payment as PaymentEntity, PaymentStatus } from './entity/payment.entity';
import { NotifyTransferPaymentDto } from './dto/notify-transfer-payment.dto';
import { UpdateTransferPaymentStatusDto } from './dto/update-transfer-payment-status.dto';

@Injectable()
export class PaymentsService {
    private client : MercadoPagoConfig; 

    constructor(
        private readonly configService : ConfigService, 

        @InjectRepository(Order)
        private readonly orderRepository : Repository<Order>,

        @InjectRepository(PaymentEntity)
        private readonly paymentRepository : Repository<PaymentEntity>,

        private readonly walletService: WalletService,
    ) {
        this.client = new MercadoPagoConfig({
            accessToken : this.configService.get<string>('MP_ACCESS_TOKEN')!,
        });
    }

    async createMercadoPagoPreference(orderId:string, userId:string) {
        const order = await this.orderRepository.findOne({
            where : {
                id : orderId, 
                buyer : {id : userId}
            }, 
            relations : [
                'buyer', 
                'items', 
                'items.product'
            ],
        });

        if(!order) {
            throw new NotFoundException('Orden no encontrada'); 
        }

        if (order.status !== OrderStatus.PENDING) {
            throw new BadRequestException('La orden no esta pendiente de pago');
        }

        if (order.paymentMethod !== PaymentMethod.MERCADO_PAGO) {
            throw new BadRequestException('La orden no usa Mercado Pago como metodo de pago');
        }

        const preference = new Preference(this.client); 

        const successUrl = this.configService.get<string>('FRONTEND_SUCCESS_URL');
        const failureUrl = this.configService.get<string>('FRONTEND_FAILURE_URL');
        const pendingUrl = this.configService.get<string>('FRONTEND_PENDING_URL');

        const backUrls = successUrl && failureUrl && pendingUrl
            ? {
                success: successUrl,
                failure: failureUrl,
                pending: pendingUrl,
            }
            : undefined;

        const result = await preference.create({
            body : {
                items: order.items.map((item) => ({
                    id : item.product.id, 
                    title : item.product.title, 
                    quantity: item.quantity, 
                    unit_price : Number(item.unitPrice),
                    currency_id : 'ARS',
                })),

                external_reference : order.id, 
                
                payer : {
                    email : order.buyer.email, 
                    name : order.buyer.firstName, 
                    surname : order.buyer.lastName
                },

                notification_url : `${this.configService.get<string>('BACKEND_URL')}/payments/mercadopago/webhook`, 

                ...(backUrls ? { back_urls: backUrls } : {}),

                metadata : {
                    orderId : order.id, 
                    buyerId : order.buyer.id,
                }, 
            },
        }); 

        order.paymentPreferenceId = result.id;
        await this.orderRepository.save(order); 

        return {
            orderId : order.id, 
            preferenceId : result.id,
            initPoint : result.init_point, 
            sandboxInitPoint : result.sandbox_init_point,
        }
    }

    async handleMercadoPagoWebhook(body:any, query:any) {
        const paymentId = body?.data?.id || query?.id; 

        if(!paymentId) {
            return {received : true}
        }

        const paymentClient = new MercadoPagoPayment(this.client); 

        const payment = await paymentClient.get({
            id : paymentId,
        }); 

        const orderId = payment.external_reference; 

        if(!orderId){
            return {received : true}
        }

        const order = await this.orderRepository.findOne({
            where : {id : orderId},
            relations : [
                'items',
                'items.product',
                'items.product.seller',
            ],
        })

        if(!order){
            return {received : true}
        }

        order.paymentId = String(payment.id); 
        order.paymentStatus = payment.status ?? undefined; 

        if (order.status === OrderStatus.PAID) {
            await this.orderRepository.save(order);
            return {received : true};
        }

        if (payment.status === 'approved') {
            order.status = OrderStatus.PAID;
        }

        if (payment.status === 'rejected') {
            order.status = OrderStatus.REJECTED;
        }

        if (payment.status === 'cancelled') {
            order.status = OrderStatus.CANCELLED;
        }

        await this.orderRepository.save(order);

        if (payment.status === 'approved') {
            await this.creditSellersFromOrder(order);
        }

        return {received : true};
    }

    async notifyTransferPayment(
        orderId: string,
        userId: string,
        dto: NotifyTransferPaymentDto,
    ) {
        const order = await this.orderRepository.findOne({
            where: {
                id: orderId,
                buyer: { id: userId },
            },
            relations: ['payment'],
        });

        if (!order) {
            throw new NotFoundException('Orden no encontrada');
        }

        if (order.paymentMethod !== PaymentMethod.TRANSFER) {
            throw new BadRequestException('La orden no usa transferencia como metodo de pago');
        }

        if (order.status !== OrderStatus.PENDING) {
            throw new BadRequestException('La orden ya fue procesada');
        }

        const payment = order.payment ?? this.paymentRepository.create({
            method: PaymentMethod.TRANSFER,
            status: PaymentStatus.PENDING,
            amount: Number(order.total),
            order,
        });

        if (payment.status !== PaymentStatus.PENDING) {
            throw new BadRequestException('El pago ya fue procesado');
        }

        payment.senderAlias = dto.senderAlias;
        payment.senderCbu = dto.senderCbu;

        await this.paymentRepository.save(payment);

        return {
            orderId: order.id,
            paymentStatus: payment.status,
            message: 'Estamos chequeando la transferencia',
        };
    }

    async updateTransferPaymentStatus(
        orderId: string,
        dto: UpdateTransferPaymentStatusDto,
    ) {
        const order = await this.orderRepository.findOne({
            where: { id: orderId },
            relations: [
                'payment',
                'items',
                'items.product',
                'items.product.seller',
            ],
        });

        if (!order) {
            throw new NotFoundException('Orden no encontrada');
        }

        if (order.paymentMethod !== PaymentMethod.TRANSFER) {
            throw new BadRequestException('La orden no usa transferencia como metodo de pago');
        }

        if (!order.payment) {
            throw new NotFoundException('Pago no encontrado');
        }

        if (order.payment.status !== PaymentStatus.PENDING || order.status !== OrderStatus.PENDING) {
            throw new BadRequestException('El pago ya fue procesado');
        }

        order.payment.status = dto.status;
        order.payment.adminNote = dto.adminNote;

        if (dto.status === PaymentStatus.COMPLETED) {
            order.status = OrderStatus.PAID;
        }

        if (dto.status === PaymentStatus.REJECTED) {
            order.status = OrderStatus.REJECTED;
        }

        await this.paymentRepository.save(order.payment);
        await this.orderRepository.save(order);

        if (dto.status === PaymentStatus.COMPLETED) {
            await this.creditSellersFromOrder(order);

            return {
                orderId: order.id,
                orderStatus: order.status,
                paymentStatus: order.payment.status,
                message: 'Pago confirmado, estamos asignando a un repartidor',
            };
        }

        return {
            orderId: order.id,
            orderStatus: order.status,
            paymentStatus: order.payment.status,
            message: 'Transferencia rechazada',
        };
    }

    private async creditSellersFromOrder(order: Order) {
        const amountsBySeller = new Map<
            string,
            { amount: number; commissionPercentage: number }
        >();

        for (const item of order.items ?? []) {
            const seller = item.product?.seller;

            if (!seller?.id) {
                continue;
            }

            const subtotal = Number(item.subtotal ?? Number(item.unitPrice) * item.quantity);
            const current = amountsBySeller.get(seller.id);
            const commissionPercentage = Number(seller.plan?.commissionPercentage ?? 0);

            amountsBySeller.set(seller.id, {
                amount: (current?.amount ?? 0) + subtotal,
                commissionPercentage,
            });
        }

        for (const [sellerId, data] of amountsBySeller) {
            await this.walletService.creditFromOrder({
                userId: sellerId,
                orderId: order.id,
                amount: data.amount,
                commisionPercentage: data.commissionPercentage,
            });
        }
    }
}
