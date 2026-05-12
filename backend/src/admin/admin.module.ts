import { Module }          from '@nestjs/common';
import { MongooseModule }  from '@nestjs/mongoose';
import { AdminController } from './admin.controller';

import { Sale, SaleSchema }                         from '../schemas/sale.schema';
import { Product, ProductSchema }                   from '../schemas/product.schema';
import { Expense, ExpenseSchema }                   from '../schemas/expense.schema';
import { Facture, FactureSchema }                   from '../schemas/facture.schema';
import { CaisseSession, CaisseSessionSchema }        from '../schemas/session.schema';
import { AuditLog, AuditLogSchema }                 from '../schemas/audit-log.schema';
import { StockMovement, StockMovementSchema }       from '../schemas/stock-movement.schema';
import { Reception, ReceptionSchema }               from '../schemas/reception.schema';
import { DemandeStock, DemandeStockSchema }         from '../schemas/demande-stock.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sale.name,          schema: SaleSchema          },
      { name: Product.name,       schema: ProductSchema       },
      { name: Expense.name,       schema: ExpenseSchema       },
      { name: Facture.name,       schema: FactureSchema       },
      { name: CaisseSession.name, schema: CaisseSessionSchema  },
      { name: AuditLog.name,      schema: AuditLogSchema      },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: Reception.name,     schema: ReceptionSchema     },
      { name: DemandeStock.name,  schema: DemandeStockSchema  },
    ]),
  ],
  controllers: [AdminController],
})
export class AdminModule {}
