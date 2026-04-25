import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { AddStockDto } from './dto/add-stock.dto';
import { RemoveStockDto } from './dto/remove-stock.dto';
export declare class StockService {
    private productModel;
    private movementModel;
    constructor(productModel: Model<ProductDocument>, movementModel: Model<StockMovementDocument>);
    addStock(dto: AddStockDto): Promise<{
        product: import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Product> & Product & {
            _id: Types.ObjectId;
        }> & import("mongoose").Document<unknown, {}, Product> & Product & {
            _id: Types.ObjectId;
        } & Required<{
            _id: Types.ObjectId;
        }>;
        newStock: number;
    }>;
    removeStock(dto: RemoveStockDto): Promise<{
        product: import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Product> & Product & {
            _id: Types.ObjectId;
        }> & import("mongoose").Document<unknown, {}, Product> & Product & {
            _id: Types.ObjectId;
        } & Required<{
            _id: Types.ObjectId;
        }>;
        newStock: number;
    }>;
    recordSaleMovement(productId: string, quantity: number): Promise<void>;
    getLowStock(): import("mongoose").Query<(import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, Product> & Product & {
        _id: Types.ObjectId;
    }> & Required<{
        _id: Types.ObjectId;
    }>)[], import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Product> & Product & {
        _id: Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, Product> & Product & {
        _id: Types.ObjectId;
    } & Required<{
        _id: Types.ObjectId;
    }>, {}, import("mongoose").Document<unknown, {}, Product> & Product & {
        _id: Types.ObjectId;
    }, "find">;
    getMovements(productId?: string): import("mongoose").Query<(import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, StockMovement> & StockMovement & {
        _id: Types.ObjectId;
    }> & Required<{
        _id: Types.ObjectId;
    }>)[], import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, StockMovement> & StockMovement & {
        _id: Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, StockMovement> & StockMovement & {
        _id: Types.ObjectId;
    } & Required<{
        _id: Types.ObjectId;
    }>, {}, import("mongoose").Document<unknown, {}, StockMovement> & StockMovement & {
        _id: Types.ObjectId;
    }, "find">;
    getProductStock(productId: string): Promise<{
        product: import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, Product> & Product & {
            _id: Types.ObjectId;
        }> & Required<{
            _id: Types.ObjectId;
        }>;
        movements: (import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, StockMovement> & StockMovement & {
            _id: Types.ObjectId;
        }> & Required<{
            _id: Types.ObjectId;
        }>)[];
    }>;
}
