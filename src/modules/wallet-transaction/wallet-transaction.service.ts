import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WalletTransaction } from './entity/wallet-transaction.entity';
import { Wallet } from '../wallet/entity/wallet.entity';

@Injectable()
export class WalletTransactionService {
    constructor (
        @InjectRepository(WalletTransaction)
        private readonly transactionRepository : Repository<WalletTransaction>,
        @InjectRepository(Wallet)
        private readonly walletRepository : Repository<Wallet>,
    ){}

    async findMyTransaction(userId:string) {
        const wallet = await this.walletRepository.findOne({
            where: {
                user : {id : userId},
            }
        }); 

        if(!wallet) {
            throw new NotFoundException('Billetera no encontrada');
        }

        return this.transactionRepository.find({
            where : {
                wallet : {id : wallet.id},
            },
            relations : {
                wallet : true, 
                order : true
            }, 
            order : {
                createdAt : 'DESC'
            }
        })
    }

    async findByWallet(walletId:string) {
        return this.transactionRepository.find({
            where : {
                wallet : {id : walletId}
            },
            relations : {
                wallet : {
                    user : true, 
                }, 
                order : true, 
            }
        })
    }

    async findAllAdmin() {
        return this.transactionRepository.find({
        relations: {
            wallet: {
            user: true,
            },
            order: true,
        },
        order: {
            createdAt: 'DESC',
        },
        });
    }
}
