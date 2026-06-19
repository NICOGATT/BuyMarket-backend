import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from '../orders/entities/order.entity';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class PaymentsService {
    private client : MercadoPagoConfig; 

    constructor(
        private readonly configService : ConfigService, 

        @InjectRepository(Order)
        private readonly orderRepository : Repository<Order>,

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

        const paymentClient = new Payment(this.client); 

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
