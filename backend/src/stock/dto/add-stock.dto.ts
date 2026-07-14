import { IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddStockDto {
  @IsMongoId()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  note?: string;

  /** Clé d'idempotence — rejeu sans doublon (synchronisation hors-ligne) */
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
