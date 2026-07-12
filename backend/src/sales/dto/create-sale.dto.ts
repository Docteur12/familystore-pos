import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemDto {
  /** Absent pour un article « divers » non référencé */
  @IsOptional()
  @IsMongoId()
  product?: string;

  /** true = article divers saisi à la volée (pas de stock à décrémenter) */
  @IsOptional()
  @IsBoolean()
  divers?: boolean;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;
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

  /** Sous-total avant réduction facture (optionnel — égal au total sinon) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  /** % de réduction facture appliqué à la caisse (offre fidélité) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  offrePct?: number;

  /** Montant déduit par la réduction facture */
  @IsOptional()
  @IsNumber()
  @Min(0)
  offreAmt?: number;

  /** Date réelle de la vente (ISO) — envoyée par la synchro hors-ligne */
  @IsOptional()
  @IsString()
  dateVente?: string;

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

  /** Clé d'idempotence — empêche le doublon en cas de réessai réseau */
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  /** Vente forcée malgré stock insuffisant */
  @IsOptional()
  forceVente?: boolean;

  /** Écarts détectés à enregistrer */
  @IsOptional()
  ecarts?: Array<{
    produit:        string;
    nomProduit:     string;
    stockSysteme:   number;
    quantiteVendue: number;
    ecart:          number;
  }>;
}
