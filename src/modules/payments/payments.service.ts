import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { InjectRepository } from '@nestjs/typeorm';
import { Or, Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';

@Injectable()
export class PaymentsService {
    private client : MercadoPagoConfig; 

    constructor(
        private readonly configService : ConfigService, 

        @InjectRepository(Order)
        private readonly orderRepository : Repository<Order>,
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

        const preference = new Preference(this.client); 

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
            where : {id : orderId}
        })

        if(!order){
            return {received : true}
        }

        order.paymentId = String(payment.id); 
        order.paymentStatus = payment.status ?? undefined; 

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
        return {received : true};
    }
}
