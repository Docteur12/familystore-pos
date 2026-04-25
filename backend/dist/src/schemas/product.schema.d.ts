import { HydratedDocument } from 'mongoose';
export type ProductDocument = HydratedDocument<Product>;
export declare class Product {
    name: string;
    barcode: string;
    price: number;
    costPrice: number;
    stock: number;
    alertThreshold: number;
    category: string;
    unit: string;
}
export declare const ProductSchema: import("mongoose").Schema<Product, import("mongoose").Model<Product, any, any, any, import("mongoose").Document<unknown, any, Product> & Product & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Product, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<Product>> & import("mongoose").FlatRecord<Product> & {
    _id: import("mongoose").Types.ObjectId;
}>;
