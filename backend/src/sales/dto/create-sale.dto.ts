export class SaleItemDto {
  product: string;
  quantity: number;
  unitPrice: number;
}

export class CreateSaleDto {
  items: SaleItemDto[];
  total: number;
  paymentMethod: string;
}
