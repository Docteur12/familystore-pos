import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
export type SaleDocument = HydratedDocument<Sale>;
declare class SaleItem {
    product: Types.ObjectId;
    name: string;
    quantity: number;
    unitPrice: number;
}
export declare class Sale {
    items: SaleItem[];
    total: number;
    paymentMethod: string;
    amountPaid: number;
    change: number;
    createdAt: Date;
}
export declare const SaleSchema: MongooseSchema<Sale, import("mongoose").Model<Sale, any, any, any, import("mongoose").Document<unknown, any, Sale> & Sale & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Sale, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<Sale>> & import("mongoose").FlatRecord<Sale> & {
    _id: Types.ObjectId;
}>;
export {};
