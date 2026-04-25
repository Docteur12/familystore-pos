import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
export declare class ProductsController {
    private productsService;
    constructor(productsService: ProductsService);
    findAll(): import("mongoose").Query<(import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
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
    findByBarcode(code: string): Promise<import("mongoose").FlattenMaps<import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    }> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>>;
    findOne(id: string): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>>;
    create(dto: CreateProductDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>>;
    update(id: string, dto: UpdateProductDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>>;
    addStock(id: string, quantity: number): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, import("../schemas/product.schema").Product> & import("../schemas/product.schema").Product & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
