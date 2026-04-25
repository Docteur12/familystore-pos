import { StockService } from './stock.service';
import { AddStockDto } from './dto/add-stock.dto';
import { RemoveStockDto } from './dto/remove-stock.dto';
export declare class StockController {
    private stockService;
    constructor(stockService: StockService);
    addStock(dto: AddStockDto): Promise<{
        product: import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
            _id: import("mongoose").Types.ObjectId;
        }> & import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
            _id: import("mongoose").Types.ObjectId;
        } & Required<{
            _id: import("mongoose").Types.ObjectId;
        }>;
        newStock: number;
    }>;
    removeStock(dto: RemoveStockDto): Promise<{
        product: import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
            _id: import("mongoose").Types.ObjectId;
        }> & import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
            _id: import("mongoose").Types.ObjectId;
        } & Required<{
            _id: import("mongoose").Types.ObjectId;
        }>;
        newStock: number;
    }>;
    getLowStock(): import("mongoose").Query<(import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    }> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>)[], import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>, {}, import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    }, "find">;
    getMovements(productId?: string): import("mongoose").Query<(import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, import("../schemas/stock-movement.schema").StockMovement> & import("../schemas/stock-movement.schema").StockMovement & {
        _id: import("mongoose").Types.ObjectId;
    }> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>)[], import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/stock-movement.schema").StockMovement> & import("../schemas/stock-movement.schema").StockMovement & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, import("../schemas/stock-movement.schema").StockMovement> & import("../schemas/stock-movement.schema").StockMovement & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>, {}, import("mongoose").Document<unknown, {}, import("../schemas/stock-movement.schema").StockMovement> & import("../schemas/stock-movement.schema").StockMovement & {
        _id: import("mongoose").Types.ObjectId;
    }, "find">;
    getProductStock(productId: string): Promise<{
        product: import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
            _id: import("mongoose").Types.ObjectId;
        }> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }>;
        movements: (import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, import("../schemas/stock-movement.schema").StockMovement> & import("../schemas/stock-movement.schema").StockMovement & {
            _id: import("mongoose").Types.ObjectId;
        }> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }>)[];
    }>;
}
