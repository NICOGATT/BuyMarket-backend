import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Wallet } from './entity/wallet.entity';
import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../wallet-transaction/entity/wallet-transaction.entity';
import {
  WithdrawalRequest,
  WithdrawalStatus,
} from '../with-drawal-request/entities/with-drawal-request.entity';
import { User } from '../users/entity/user.entity';


@Injectable()
export class WalletService {
    constructor (
        @InjectRepository(Wallet)
        private readonly walletsRepository : Repository<Wallet>,
        @InjectRepository(WalletTransaction)
        private readonly transactionRepository : Repository<WalletTransaction>,
        @InjectRepository(WithdrawalRequest)
        private readonly withdrawalsRepository : Repository<WithdrawalRequest>,
        @InjectRepository(User)
        private readonly usersRepository : Repository<User>,
    ) {}

    async findByUserId(userId:string) {
        const wallet = await this.walletsRepository.findOne({
            where : {
                user : {id : userId}
            }, 
            relations : {
                user : true, 
                transactions : true, 
                withdrawals : true
            },
        }); 

        if(!wallet) {
            throw new NotFoundException('Billetera no encontrada');
        }

        return wallet
    }

    async findMyBalance(userId:string) {
        const wallet = await this.findByUserId(userId); 

        return {
            balance : Number(wallet.balance), 
            pendingBalance : Number(wallet.pendingBalance), 
            totalEarned : Number(wallet.totalEarned)
        }
    }

    async findAll() {
        return this.walletsRepository.find(({
            relations : {
                user : true, 
                transactions : true, 
                withdrawals : true
            }, 
            order : {
                createdAt : 'DESC'
            }
        }))
    }

    async findOne(id : string) {
        const wallet = await this.walletsRepository.findOne(({
            where : {id}, 
            relations : {
                user : true, 
                transactions : true, 
                withdrawals : true
            }
        }))

        if(!wallet) {
            throw new NotFoundException("Billetera no encontrada");
        }

        return wallet
    }

    async creditFromOrder(params : {
        userId : string; 
        orderId : string; 
        amount : number; 
        commisionPercentage: number;
    }) {
        const wallet = await this.findByUserId(params.userId); 

        const commissionAmount = params.amount * (params.commisionPercentage / 100); 

        const netAmount = params.amount - commissionAmount; 

        wallet.balance = Number(wallet.balance) + Number(netAmount); 

        wallet.totalEarned = Number(wallet.totalEarned) + Number(netAmount); 

        await this.walletsRepository.save(wallet)

        const transaction = this.transactionRepository.create({
            wallet, 
            order : {
                id : params.orderId,
            } as any,
            type : WalletTransactionType.CREDIT, 
            amount : params.amount, 
            commissionAmount, 
            netAmount, 
            status : WalletTransactionStatus.COMPLETED,
        }); 

        await this.transactionRepository.save(transaction)

        return {
            wallet, 
            transaction
        }
    }

    async requestWithDrawal(params: {
        userId : string; 
        amount : number; 
        alias? : string; 
        cbu? : string; 
    }) {    
        const wallet = await this.findByUserId(params.userId); 

        if(!params.alias && !params.cbu) {
            throw new BadRequestException(
                'Tenés que ingresar alias o cbu',
            )
        }

        if(Number(wallet.balance) < params.amount) {
            throw new BadRequestException(
                'Saldo insuficiente'
            )
        }

        wallet.balance = Number(wallet.balance) - Number(params.amount); 

        wallet.pendingBalance = Number(wallet.pendingBalance) + Number(params.amount); 
        
        await this.walletsRepository.save(wallet); 

        const withdrawal = this.withdrawalsRepository.create({
            wallet, 
            amount : params.amount, 
            alias : params.alias,
            cbu : params.cbu,
            status : WithdrawalStatus.PENDING
        }); 

        return this.withdrawalsRepository.save(withdrawal);
    }

    async findMyWithdrawals(userId:string) {
        const wallet = await this.findByUserId(userId);

        return this.withdrawalsRepository.find({
            where : {
                wallet : {id : wallet.id}
            }, 
            order : {
                createdAt : 'DESC'
            }
        })
    }

    async findAllWithdrawals() {
        return this.withdrawalsRepository.find({
        relations: {
            wallet: {
            user: true,
            },
        },
        order: {
            createdAt: 'DESC',
        },
        });
    }

    async updateWithdrawalStatus(
        id : string, 
        status : WithdrawalStatus, 
        adminNote ? : string,
    ) {
        const withdrawal = await this.withdrawalsRepository.findOne({
            where : {id}, 
            relations : {
                wallet : true
            }
        }); 

        if(!withdrawal) {
            throw new NotFoundException(
                'Solicitud de retiro no encontrada',
            )
        }

        if(withdrawal.status !== WithdrawalStatus.PENDING){
            throw new BadRequestException('Esta solicitud ya fue procesada');
        }

        if(status === WithdrawalStatus.REJECTED){
            withdrawal.wallet.pendingBalance = Number(withdrawal.wallet.pendingBalance) - Number(withdrawal.amount)
            withdrawal.wallet.balance = Number(withdrawal.wallet.balance) + Number(withdrawal.amount)
            await this.walletsRepository.save(withdrawal.wallet); 
        }

        if (status === WithdrawalStatus.PAID) {
            withdrawal.wallet.pendingBalance =
                Number(withdrawal.wallet.pendingBalance) -
                Number(withdrawal.amount);

            await this.walletsRepository.save(withdrawal.wallet);
        }

        withdrawal.status = status;
        withdrawal.adminNote = adminNote;

        return this.withdrawalsRepository.save(withdrawal);
    }

    async syncMissingWallets() {
        const users = await this.usersRepository.find({
            relations: {
            wallet: true,
            },
        });

        const usersWithoutWallet = users.filter(user => !user.wallet);

        const wallets = usersWithoutWallet.map(user =>
            this.walletsRepository.create({
            user,
            balance: 0,
            pendingBalance: 0,
            totalEarned: 0,
            }),
        );

        await this.walletsRepository.save(wallets);

        return {
            message: 'Wallets sincronizadas correctamente',
            created: wallets.length,
        };
    }
}
