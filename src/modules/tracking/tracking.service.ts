import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tracking, TrackingDocument } from './schemas/tracking.schema';
import { CreateTrackingDto, GetTrackingDto, MergeTrackingDto } from './dto/tracking.dto';

@Injectable()
export class TrackingService {
  constructor(
    @InjectModel(Tracking.name)
    private trackingModel: Model<TrackingDocument>,
  ) {}

  async create(createTrackingDto: CreateTrackingDto): Promise<Tracking> {
    const tracking = new this.trackingModel(createTrackingDto);
    return tracking.save();
  }

  // Merge anonymous tracking data with user ID when user logs in
  async mergeAnonymousTracking(mergeDto: MergeTrackingDto): Promise<{ updated: number }> {
    const { sessionId, userId } = mergeDto;
    
    // Update all anonymous tracking records for this session
    const result = await this.trackingModel.updateMany(
      { 
        userId: 'anonymous',
        sessionId: sessionId 
      },
      { 
        userId: userId,
        sessionId: undefined // Clear session ID after merge
      }
    );

    return { updated: result.modifiedCount };
  }

  // Get tracking by session ID (for anonymous users)
  async findBySessionId(sessionId: string, limit: number = 50): Promise<Tracking[]> {
    return this.trackingModel
      .find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  // Get tracking by user ID (includes merged anonymous data)
  async findByUserId(userId: string, limit: number = 50): Promise<Tracking[]> {
    return this.trackingModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async findAll(query: GetTrackingDto): Promise<Tracking[]> {
    const { userId, productId, action, limit, startDate, endDate } = query;
    
    const filter: any = {};
    
    if (userId) filter.userId = userId;
    if (productId) filter.productId = productId;
    if (action) filter.action = action;
    
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = startDate;
      if (endDate) filter.timestamp.$lte = endDate;
    }

    const limitNumber = limit ? parseInt(limit) : 50;

    return this.trackingModel
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limitNumber)
      .exec();
  }

  async getPopularProducts(limit: number = 10): Promise<any[]> {
    const result = await this.trackingModel.aggregate([
      { $match: { action: 'view', productId: { $regex: /^[a-fA-F0-9]{24}$/ } } },
      {
        $group: {
          _id: '$productId',
          viewCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          productId: '$_id',
          viewCount: 1,
          uniqueUserCount: { $size: '$uniqueUsers' },
          _id: 0
        }
      },
      { $sort: { viewCount: -1 } },
      { $limit: limit }
    ]);

    return result;
  }

  async getRecentlyViewed(userId: string, limit: number = 10): Promise<any[]> {
    return this.trackingModel
      .find({ userId, action: 'view' })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async getUserBehaviorStats(userId: string): Promise<any> {
    const stats = await this.trackingModel.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      }
    ]);

    return stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        lastActivity: stat.lastActivity
      };
      return acc;
    }, {});
  }

  async getHourlyStats(): Promise<any[]> {
    const result = await this.trackingModel.aggregate([
      {
        $group: {
          _id: {
            hour: { $hour: { $toDate: '$timestamp' } },
            action: '$action'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.hour',
          actions: {
            $push: {
              action: '$_id.action',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return result;
  }

  async getDailyStats(days: number = 7): Promise<any[]> {
    const result = await this.trackingModel.aggregate([
      {
        $match: {
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$timestamp' } } },
            action: '$action'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          actions: {
            $push: {
              action: '$_id.action',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return result;
  }

  // Recommendation methods

  async getCollaborativeRecommendations(userId: string, limit: number = 10): Promise<any[]> {
    // Find users with similar behavior
    const similarUsers = await this.trackingModel.aggregate([
      { $match: { userId } },
      { $group: { _id: '$productId', actions: { $push: '$action' } } },
      { $unwind: '$actions' },
      { $group: { _id: '$actions', products: { $addToSet: '$_id' } } }
    ]);

    // Get products viewed by similar users but not by current user
    const recommendations = await this.trackingModel.aggregate([
      { $match: { userId: { $ne: userId }, productId: { $regex: /^[a-fA-F0-9]{24}$/ } } },
      {
        $group: {
          _id: '$productId',
          score: { $sum: 1 },
          users: { $addToSet: '$userId' }
        }
      },
      { $sort: { score: -1 } },
      { $limit: limit }
    ]);

    return recommendations.map(item => ({
      productId: item._id,
      score: item.score / item.users.length, // Normalize by user count
      reason: 'similar_users',
      type: 'collaborative'
    }));
  }

  async getContentBasedRecommendations(userId: string, limit: number = 10): Promise<any[]> {
    // Get user's viewed products
    const userProducts = await this.trackingModel
      .find({ userId, action: 'view' })
      .distinct('productId');

    const validUserProducts = userProducts.filter((id: string) => Types.ObjectId.isValid(id));

    if (validUserProducts.length === 0) return [];

    // Find products in same categories
    const recommendations = await this.trackingModel.aggregate([
      { $match: { productId: { $in: validUserProducts }, categoryId: { $exists: true } } },
      { $group: { _id: '$categoryId', products: { $addToSet: '$productId' } } },
      { $unwind: '$products' },
      {
        $lookup: {
          from: 'trackings',
          localField: '_id',
          foreignField: 'categoryId',
          as: 'categoryProducts'
        }
      },
      { $unwind: '$categoryProducts' },
      { $match: { 'categoryProducts.productId': { $regex: /^[a-fA-F0-9]{24}$/, $nin: validUserProducts } } },
      {
        $group: {
          _id: '$categoryProducts.productId',
          score: { $sum: 1 },
          categoryId: { $first: '$_id' }
        }
      },
      { $sort: { score: -1 } },
      { $limit: limit }
    ]);

    return recommendations.map(item => ({
      productId: item._id,
      score: item.score,
      categoryId: item.categoryId,
      reason: 'similar_products',
      type: 'content_based'
    }));
  }

  async getSimilarProducts(productId: string, limit: number = 10): Promise<any[]> {
    if (!Types.ObjectId.isValid(productId)) return [];

    // Find products viewed by users who viewed this product
    const similarProducts = await this.trackingModel.aggregate([
      { $match: { productId, action: 'view' } },
      { $group: { _id: '$userId', products: { $addToSet: '$productId' } } },
      { $unwind: '$products' },
      { $match: { products: { $ne: productId } } },
      {
        $group: {
          _id: '$products',
          score: { $sum: 1 }
        }
      },
      { $sort: { score: -1 } },
      { $limit: limit }
    ]);

    return similarProducts.map(item => ({
      productId: item._id,
      score: item.score,
      reason: 'similar_products',
      type: 'similar'
    }));
  }

  async getRecommendations(userId: string, limit: number = 10): Promise<any[]> {
    const [collaborative, contentBased, popular] = await Promise.all([
      this.getCollaborativeRecommendations(userId, Math.ceil(limit / 3)),
      this.getContentBasedRecommendations(userId, Math.ceil(limit / 3)),
      this.getPopularProducts(Math.ceil(limit / 3))
    ]);

    // Combine and weight recommendations
    const allRecommendations = [
      ...collaborative.map(r => ({ ...r, weight: 0.5 })),
      ...contentBased.map(r => ({ ...r, weight: 0.3 })),
      ...popular.map(r => ({ 
        productId: r.productId, 
        score: r.viewCount, 
        reason: 'popular',
        type: 'popular',
        weight: 0.2 
      }))
    ];

    // Sort by weighted score and limit
    return allRecommendations
      .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))
      .slice(0, limit);
  }

  // Legacy methods for backward compatibility
  findOne(id: number) {
    return this.trackingModel.findById(id).exec();
  }

  update(id: number, updateTrackingDto: any) {
    return this.trackingModel.findByIdAndUpdate(id, updateTrackingDto).exec();
  }

  remove(id: number) {
    return this.trackingModel.findByIdAndDelete(id).exec();
  }
}
