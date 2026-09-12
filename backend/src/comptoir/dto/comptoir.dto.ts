import { IsInt, IsMongoId, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class DefinirConditionnementDto {
  @IsInt() @Min(1)
  bouteillesParCasier: number;

  @IsNumber() @Min(0)
  consigne: number;
}

export class ReceptionCasiersDto {
  @IsMongoId()
  productId: string;

  @IsInt() @Min(1)
  casiers: number;

  /** Bouteilles vides rendues au livreur en échange (défaut 0). */
  @IsOptional() @IsInt() @Min(0)
  videsRendus?: number;

  @IsOptional() @IsString() @MaxLength(200)
  note?: string;

  @IsOptional() @IsString()
  idempotencyKey?: string;
}

export class CasseDto {
  @IsMongoId()
  productId: string;

  @IsInt() @Min(1)
  bouteilles: number;

  @IsOptional() @IsString() @MaxLength(200)
  note?: string;

  @IsOptional() @IsString()
  idempotencyKey?: string;
}

export class RetourVidesDto {
  @IsMongoId()
  productId: string;

  @IsInt() @Min(1)
  quantite: number;

  @IsOptional() @IsString()
  idempotencyKey?: string;
}
