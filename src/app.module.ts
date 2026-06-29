import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartsModule } from './modules/carts/carts.module';
import { FavoritesModule } from './modules/favorites/favorites.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { OrdersModule } from './modules/orders/orders.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CategorySuggestionsModule } from './modules/category-suggestions/category-suggestions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductMediaModule } from './modules/products/product-media/product-media.module';
import { SubCategoriesModule } from './modules/subcategoria/subcategoria.module';
import { SubCategoryAttributesModule } from './modules/subcategoria/subcategoria-attributes/subcategoria-attributes.module';
import { PlansModule } from './modules/plan/plan.module';
import { WalletsModule } from './modules/wallet/wallet.module';
import { WalletTransactionsModule } from './modules/wallet-transaction/wallet-transaction.module';
import { WithdrawalRequestsModule } from './modules/with-drawal-request/with-drawal-request.module';
import { UserAddressesModule } from './modules/user-address/user-address.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { WalletMovementModule } from './modules/wallet-movement/wallet-movement.module';
import { ShipmentsModule } from './modules/shipments/shipments.module'; 
import { MailModule } from './modules/mail/mail.module'; 
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: Number(config.get<string>('DB_PORT')),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),

    UsersModule,
    ProductsModule,
    AuthModule,
    CartsModule,
    FavoritesModule,
    OrdersModule,
    CategoriesModule,
    CategorySuggestionsModule,
    PaymentsModule,
    ProductMediaModule,
    SubCategoriesModule,
    SubCategoryAttributesModule,
    PlansModule,
    WalletsModule,
    WalletTransactionsModule,
    WithdrawalRequestsModule,
    UserAddressesModule,
    CloudinaryModule,
    WalletMovementModule,
    ShipmentsModule,
    MailModule,
  ],
})
export class AppModule {}
