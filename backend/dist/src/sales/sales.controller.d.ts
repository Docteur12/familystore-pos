import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
export declare class SalesController {
    private salesService;
    constructor(salesService: SalesService);
    create(dto: CreateSaleDto): Promise<{
        sale: import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/sale.schema").Sale> & import("../schemas/sale.schema").Sale & {
            _id: import("mongoose").Types.ObjectId;
        }> & import("mongoose").Document<unknown, {}, import("../schemas/sale.schema").Sale> & import("../schemas/sale.schema").Sale & {
            _id: import("mongoose").Types.ObjectId;
        } & Required<{
            _id: import("mongoose").Types.ObjectId;
        }>;
        change: number;
        alerts: import("./sales.service").StockAlert[];
    }>;
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
    findAll(): import("mongoose").Query<(import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, import("../schemas/sale.schema").Sale> & import("../schemas/sale.schema").Sale & {
        _id: import("mongoose").Types.ObjectId;
    }> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>)[], import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/sale.schema").Sale> & import("../schemas/sale.schema").Sale & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, import("../schemas/sale.schema").Sale> & import("../schemas/sale.schema").Sale & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>, {}, import("mongoose").Document<unknown, {}, import("../schemas/sale.schema").Sale> & import("../schemas/sale.schema").Sale & {
        _id: import("mongoose").Types.ObjectId;
    }, "find">;
    findOne(id: string): Promise<import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, import("../schemas/sale.schema").Sale> & import("../schemas/sale.schema").Sale & {
        _id: import("mongoose").Types.ObjectId;
    }> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>>;
}
