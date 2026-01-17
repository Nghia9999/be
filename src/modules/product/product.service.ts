import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './product.schema';
import { Category, CategoryDocument } from '../category/category.schema';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(dto: CreateProductDto) {
    const categoryId = dto.category as any;
    const category = await this.categoryModel.findById(categoryId).lean();
    if (!category) throw new NotFoundException('Category not found');
    if (!category.isLeaf)
      throw new BadRequestException(
        'Product can only be created under a leaf category',
      );

    const created = await this.productModel.create(dto as any);
    return created;
  }

  async findAll(category?: string, limit = 50, skip = 0, search?: string) {
    const filter: any = {};

    if (category && Types.ObjectId.isValid(category)) {
      const cat = await this.categoryModel.findById(category).lean();
      if (cat) {
        // If this is a parent category, include all descendant categories.
        if ((cat as any).isLeaf === false) {
          const ids: string[] = [category];
          const queue: string[] = [category];

          while (queue.length) {
            const parentId = queue.shift() as string;
            const children = await this.categoryModel
              .find({ parent: parentId })
              .select('_id')
              .lean();

            for (const child of children) {
              const id = (child as any)._id?.toString();
              if (id && !ids.includes(id)) {
                ids.push(id);
                queue.push(id);
              }
            }
          }

          filter.category = { $in: ids };
        } else {
          filter.category = category;
        }
      } else {
        // If category id is not found, keep the original filter (will return empty).
        filter.category = category;
      }
    } else if (category) {
      // If a non-ObjectId is provided, keep behavior (likely returns empty).
      filter.category = category;
    }

    // Add search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pipeline: any[] = [
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'ratings',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$productId', '$$pid'] } } },
            {
              $group: {
                _id: '$productId',
                averageRating: { $avg: '$value' },
                ratingCount: { $sum: 1 },
              },
            },
            { $project: { _id: 0, averageRating: 1, ratingCount: 1 } },
          ],
          as: 'ratingSummary',
        },
      },
      {
        $addFields: {
          averageRating: {
            $ifNull: [{ $arrayElemAt: ['$ratingSummary.averageRating', 0] }, 0],
          },
          ratingCount: {
            $ifNull: [{ $arrayElemAt: ['$ratingSummary.ratingCount', 0] }, 0],
          },
        },
      },
      { $project: { ratingSummary: 0 } },
    ];

    return this.productModel.aggregate(pipeline);
  }

  async count(category?: string, search?: string): Promise<number> {
    const filter: any = {};

    if (category && Types.ObjectId.isValid(category)) {
      const cat = await this.categoryModel.findById(category).lean();
      if (cat) {
        // If this is a parent category, include all descendant categories.
        if ((cat as any).isLeaf === false) {
          const ids: string[] = [category];
          const queue: string[] = [category];

          while (queue.length) {
            const parentId = queue.shift() as string;
            const children = await this.categoryModel
              .find({ parent: parentId })
              .select('_id')
              .lean();

            for (const child of children) {
              const id = (child as any)._id?.toString();
              if (id && !ids.includes(id)) {
                ids.push(id);
                queue.push(id);
              }
            }
          }

          filter.category = { $in: ids };
        } else {
          filter.category = category;
        }
      } else {
        filter.category = category;
      }
    } else if (category) {
      filter.category = category;
    }

    // Add search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    return this.productModel.countDocuments(filter);
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Product not found');

    const res = await this.productModel.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'ratings',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$productId', '$$pid'] } } },
            {
              $group: {
                _id: '$productId',
                averageRating: { $avg: '$value' },
                ratingCount: { $sum: 1 },
              },
            },
            { $project: { _id: 0, averageRating: 1, ratingCount: 1 } },
          ],
          as: 'ratingSummary',
        },
      },
      {
        $addFields: {
          averageRating: {
            $ifNull: [{ $arrayElemAt: ['$ratingSummary.averageRating', 0] }, 0],
          },
          ratingCount: {
            $ifNull: [{ $arrayElemAt: ['$ratingSummary.ratingCount', 0] }, 0],
          },
        },
      },
      { $project: { ratingSummary: 0 } },
      { $limit: 1 },
    ]);

    const prod = res?.[0];
    if (!prod) throw new NotFoundException('Product not found');
    return prod;
  }

  async update(id: string, dto: UpdateProductDto) {
    const updated = await this.productModel
      .findByIdAndUpdate(id, dto as any, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Product not found');
    return updated;
  }

  async remove(id: string) {
    const res = await this.productModel.findByIdAndDelete(id).lean();
    if (!res) throw new NotFoundException('Product not found');
    return { ok: true };
  }
}
