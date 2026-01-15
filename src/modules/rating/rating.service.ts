import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRatingDto } from './dto/create-rating.dto';
import { Rating, RatingDocument } from './schemas/rating.schema';

@Injectable()
export class RatingService {
  constructor(
    @InjectModel(Rating.name) private ratingModel: Model<RatingDocument>,
  ) {}

  async upsert(dto: CreateRatingDto) {
    const updated = await this.ratingModel
      .findOneAndUpdate(
        { productId: dto.productId, userId: dto.userId },
        { $set: { value: dto.value, comment: dto.comment } },
        { upsert: true, new: true }
      )
      .lean();
    return updated;
  }

  async findByProduct(productId: string) {
    return this.ratingModel
      .find({ productId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getSummary(productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      return { averageRating: 0, ratingCount: 0 };
    }

    const res = await this.ratingModel.aggregate([
      { $match: { productId: new Types.ObjectId(productId) } },
      {
        $group: {
          _id: '$productId',
          averageRating: { $avg: '$value' },
          ratingCount: { $sum: 1 },
        },
      },
      { $project: { _id: 0, averageRating: 1, ratingCount: 1 } },
    ]);

    return res?.[0] || { averageRating: 0, ratingCount: 0 };
  }
}
