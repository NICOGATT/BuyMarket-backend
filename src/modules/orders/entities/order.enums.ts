export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  DELIVERED = 'delivered',
  REJECTED = 'rejected',
}

export enum PaymentMethod {
  MERCADO_PAGO = 'mercado_pago',
  GETNET = 'getnet',
  GETNET_QR = 'getnet_qr',
  CASH = 'cash',
  TRANSFER = 'transfer',
}
