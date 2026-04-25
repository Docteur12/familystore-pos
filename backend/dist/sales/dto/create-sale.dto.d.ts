export declare class SaleItemDto {
    product: string;
    name: string;
    quantity: number;
    unitPrice: number;
}
export declare class CreateSaleDto {
    items: SaleItemDto[];
    total: number;
    paymentMethod: string;
    amountPaid: number;
}
