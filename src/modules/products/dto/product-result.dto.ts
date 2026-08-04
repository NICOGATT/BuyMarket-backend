export interface ProductResult {
  productId: string;
  variantId: string | null;
  name: string;
  brand: string | null;
  color: string | null;
  size: string | null;
  stock: number;
  price: number;
  currency: 'ARS';
}
