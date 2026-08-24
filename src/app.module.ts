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
import { UserPaymentMethodsModule } from './modules/user-payment-methods/user-payment-methods.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BrandsModule } from './modules/brands/brands.module';
import { ColorsModule } from './modules/colors/colors.module';
import { resolveDatabaseSynchronize } from './config/database-synchronize';
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
        // Produccion siempre false; fuera de produccion solo con
        // DB_SYNCHRONIZE explicito. Ver src/config/database-synchronize.ts.
        synchronize: resolveDatabaseSynchronize({
          nodeEnv: config.get<string>('NODE_ENV'),
          dbSynchronize: config.get<string | boolean>('DB_SYNCHRONIZE'),
        }),
        ssl:
          config.get<string>('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
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
    UserPaymentMethodsModule,
    NotificationsModule,
    BrandsModule,
    ColorsModule,
  ],
})
export class AppModule {}
