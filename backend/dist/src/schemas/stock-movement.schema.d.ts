import { HydratedDocument, Types } from 'mongoose';
export type StockMovementDocument = HydratedDocument<StockMovement>;
export type MovementType = 'IN' | 'OUT';
export type MovementReason = 'restock' | 'sale' | 'adjustment';
export declare class StockMovement {
    productId: Types.ObjectId;
    type: MovementType;
    quantity: number;
    reason: MovementReason;
    note?: string;
}
export declare const StockMovementSchema: import("mongoose").Schema<StockMovement, import("mongoose").Model<StockMovement, any, any, any, import("mongoose").Document<unknown, any, StockMovement> & StockMovement & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, StockMovement, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<StockMovement>> & import("mongoose").FlatRecord<StockMovement> & {
    _id: Types.ObjectId;
}>;
