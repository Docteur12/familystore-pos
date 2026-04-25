import { Model, Types } from 'mongoose';
import { Sale, SaleDocument } from '../schemas/sale.schema';
import { ProductDocument } from '../schemas/product.schema';
import { StockMovementDocument } from '../schemas/stock-movement.schema';
import { MailService } from '../mail/mail.service';
import { CreateSaleDto } from './dto/create-sale.dto';
export interface StockAlert {
    alert: true;
    productId: string;
    productName: string;
    stock: number;
    alertThreshold: number;
}
export declare class SalesService {
    private saleModel;
    private productModel;
    private movementModel;
    private mailService;
    private readonly logger;
    constructor(saleModel: Model<SaleDocument>, productModel: Model<ProductDocument>, movementModel: Model<StockMovementDocument>, mailService: MailService);
    create(dto: CreateSaleDto): Promise<{
        sale: import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Sale> & Sale & {
            _id: Types.ObjectId;
        }> & import("mongoose").Document<unknown, {}, Sale> & Sale & {
            _id: Types.ObjectId;
        } & Required<{
            _id: Types.ObjectId;
        }>;
        change: number;
        alerts: StockAlert[];
    }>;
    findAll(): import("mongoose").Query<(import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, Sale> & Sale & {
        _id: Types.ObjectId;
    }> & Required<{
        _id: Types.ObjectId;
    }>)[], import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Sale> & Sale & {
        _id: Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, Sale> & Sale & {
        _id: Types.ObjectId;
    } & Required<{
        _id: Types.ObjectId;
    }>, {}, import("mongoose").Document<unknown, {}, Sale> & Sale & {
        _id: Types.ObjectId;
    }, "find">;
    findOne(id: string): Promise<import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, Sale> & Sale & {
        _id: Types.ObjectId;
    }> & Required<{
        _id: Types.ObjectId;
    }>>;
    statsToday(): Promise<{
        date: string;
        totalCA: number;
        nbVentes: number;
        benefice: number;
        marge: number;
    }>;
    statsWeek(): Promise<{
        date: string;
        label: string;
        totalCA: number;
        nbVentes: number;
    }[]>;
    topProducts(): import("mongoose").Aggregate<any[]>;
}
