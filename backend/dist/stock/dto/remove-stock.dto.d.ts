export declare class RemoveStockDto {
    productId: string;
    quantity: number;
    reason: 'sale' | 'adjustment';
    note?: string;
}
