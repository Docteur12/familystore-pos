import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemDto {
  @IsMongoId()
  product: string;

  /** Snapshot du nom (stocké tel quel dans la vente) */
  @IsString()
  @MinLength(1)
  name: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsNumber()
  @Min(0)
  total: number;

  @IsIn(['cash', 'mtn_momo', 'orange_money', 'card', 'mobile_money', 'credit'])
  paymentMethod: string;

  /** Montant remis par le client (>= total pour cash) */
  @IsNumber()
  @Min(0)
  amountPaid: number;

  /** ID de la session de travail caissière (optionnel) */
  @IsOptional()
  @IsString()
  sessionId?: string;
}
