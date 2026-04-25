import { IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RemoveStockDto {
  @IsMongoId()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsIn(['sale', 'adjustment'])
  reason: 'sale' | 'adjustment';

  @IsOptional()
  @IsString()
  note?: string;
}
