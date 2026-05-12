import { Controller, Post, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthGuard }  from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles }      from '../auth/roles.decorator';

// Schemas
import { Sale, SaleDocument }                from '../schemas/sale.schema';
import { Product, ProductDocument }          from '../schemas/product.schema';
import { Expense, ExpenseDocument }          from '../schemas/expense.schema';
import { Facture, FactureDocument }          from '../schemas/facture.schema';
import { CaisseSession, SessionDocument }    from '../schemas/session.schema';
import { AuditLog, AuditLogDocument }        from '../schemas/audit-log.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { Reception, ReceptionDocument }      from '../schemas/reception.schema';
import { DemandeStock, DemandeStockDocument } from '../schemas/demande-stock.schema';

// User schema access via mongoose directly
import { InjectConnection } from '@nestjs/mongoose';
import { Connection }       from 'mongoose';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('patron')
export class AdminController {
  constructor(
    @InjectConnection()                                          private conn: Connection,
    @InjectModel(Sale.name)          private saleModel:         Model<SaleDocument>,
    @InjectModel(Product.name)       private productModel:      Model<ProductDocument>,
    @InjectModel(Expense.name)       private expenseModel:      Model<ExpenseDocument>,
    @InjectModel(Facture.name)       private factureModel:      Model<FactureDocument>,
    @InjectModel(CaisseSession.name) private sessionModel:      Model<SessionDocument>,
    @InjectModel(AuditLog.name)      private auditModel:        Model<AuditLogDocument>,
    @InjectModel(StockMovement.name) private movementModel:     Model<StockMovementDocument>,
    @InjectModel(Reception.name)     private receptionModel:    Model<ReceptionDocument>,
    @InjectModel(DemandeStock.name)  private demandeModel:      Model<DemandeStockDocument>,
  ) {}

  // POST /api/admin/reset  — réinitialise toutes les données de test
  @Post('reset')
  async reset() {
    // Supprimer uniquement les rôles opérationnels — JAMAIS les patrons
    await this.conn.collection('users').deleteMany({
      role: { $in: ['caissier', 'gestionnaire', 'magazinier'] },
    });

    // Supprimer toutes les données transactionnelles
    await Promise.all([
      this.saleModel.deleteMany({}),
      this.productModel.deleteMany({}),
      this.expenseModel.deleteMany({}),
      this.factureModel.deleteMany({}),
      this.sessionModel.deleteMany({}),
      this.auditModel.deleteMany({}),
      this.movementModel.deleteMany({}),
      this.receptionModel.deleteMany({}),
      this.demandeModel.deleteMany({}),
    ]);

    return { message: 'Base de données réinitialisée avec succès. Seul le compte patron a été conservé.' };
  }
}
