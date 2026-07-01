import 'dotenv/config';
import { DataSource } from 'typeorm';
import { v2 as cloudinary } from 'cloudinary';
import * as path from 'path';
import * as fs from 'fs';

import { Category } from '../src/modules/categories/entities/category.entity';
import { Product } from '../src/modules/products/entity/product.entity';
import { SubCategory } from '../src/modules/subcategoria/entities/subcategoria.entity';
import { SubCategoryAttribute } from '../src/modules/subcategoria/subcategoria-attributes/entities/subcategoria-attribute.entity';
import { ProductAttributeValue } from '../src/modules/products/entity/product-attributes-value.entity';
import { ProductMedia } from '../src/modules/products/product-media/entities/product-media.entity';
import { User } from '../src/modules/users/entity/user.entity';
import { Wallet } from '../src/modules/wallet/entity/wallet.entity';
import { WalletTransaction } from '../src/modules/wallet-transaction/entity/wallet-transaction.entity';
import { Order } from '../src/modules/orders/entities/order.entity';
import { OrderItem } from '../src/modules/orders/entities/order-item.entity';
import { Payment } from '../src/modules/payments/entity/payment.entity';
import { Shipment } from '../src/modules/shipments/entities/shipment.entity';
import { WithdrawalRequest } from '../src/modules/with-drawal-request/entities/with-drawal-request.entity';
import { Plan } from '../src/modules/plan/entities/plan.entity';
import { UserAddress } from '../src/modules/user-address/entities/user-address.entity';
import { CartItem } from '../src/modules/carts/entities/cart-item.entity/cart-item.entity';
import { Cart } from '../src/modules/carts/entities/cart.entity';
const dataSource = new DataSource({
    type: 'postgres', 
    host: process.env.DB_HOST, 
    port: Number(process.env.DB_PORT), 
    username: process.env.DB_USER,  
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_DATABASE, 
    entities: [
      Category, 
      Product, 
      SubCategory, 
      SubCategoryAttribute, 
      ProductAttributeValue, 
      ProductMedia, 
      User, 
      Wallet, 
      WalletTransaction, 
      Order, 
      OrderItem, 
      Payment, 
      Shipment, 
      WithdrawalRequest, 
      Plan,
      UserAddress, 
      CartItem, 
      Cart
    ], 
    synchronize: false,
    ssl : false
})


async function bootstrap() {
  await dataSource.initialize();

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const categoryRepo = dataSource.getRepository(Category);

  const categories = await categoryRepo.find();

  for (const category of categories) {
    if (!category.icon) continue;

    if (category.icon.startsWith('https://res.cloudinary.com')) {
      console.log(`Ya está migrada: ${category.name}`);
      continue;
    }

    const cleanPath = category.icon.replace('http://localhost:3000/', '');
    const localPath = path.join(process.cwd(), cleanPath);

    if (!fs.existsSync(localPath)) {
      console.log(`No existe imagen local para ${category.name}: ${localPath}`);
      continue;
    }

    const result = await cloudinary.uploader.upload(localPath, {
      folder: 'buymarket/categories',
    });

    category.icon = result.secure_url;

    await categoryRepo.save(category);

    console.log(`Migrada ${category.name}: ${result.secure_url}`);
  }

  await dataSource.destroy();
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
