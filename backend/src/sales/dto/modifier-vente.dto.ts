import {
  ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Max, Min, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SaleItemDto } from './create-sale.dto';

/**
 * Correction d'une vente déjà enregistrée — le client revient avec son ticket.
 *
 * Garde-fous portés par ce DTO :
 *  - `motif` OBLIGATOIRE (≥ 5 caractères) : une correction de caisse sans
 *    justification écrite est indéfendable en cas de contestation ;
 *  - au moins une ligne : vider un ticket, c'est une suppression — elle a sa
 *    propre route, sa propre confirmation et sa propre trace ;
 *  - les totaux ne sont PAS acceptés depuis le client : ils sont recalculés par
 *    le service à partir des lignes (sinon on pourrait poster n'importe quel
 *    montant et fausser la comptabilité).
 */
export class ModifierVenteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  /** % de réduction facture. Absent = on garde celui de la vente d'origine. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  offrePct?: number;

  @IsOptional()
  @IsIn(['cash', 'mtn_momo', 'orange_money', 'card', 'mobile_money', 'credit'])
  paymentMethod?: string;

  /** Montant remis par le client. Absent = inchangé. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @IsString()
  @MinLength(5, { message: 'Le motif de la correction est obligatoire (5 caractères minimum).' })
  motif: string;
}

/** Suppression d'une vente : même exigence de justification. */
export class SupprimerVenteDto {
  @IsString()
  @MinLength(5, { message: 'Le motif de la suppression est obligatoire (5 caractères minimum).' })
  motif: string;
}
