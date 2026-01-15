import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

export interface CartItem {
  _id: string;
  sessionId: string; // For anonymous users
  userId?: string; // For logged-in users
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CartService {
  constructor(@InjectModel('Cart') private cartModel: Model<CartItem>) {}

  async create(createCartDto: CreateCartDto): Promise<CartItem> {
    const { sessionId, userId, productId, size, color } = createCartDto;
    
    // Check if item already exists
    const existingItem = await this.cartModel.findOne({
      $or: [
        { sessionId, productId, size: size || null, color: color || null },
        { userId, productId, size: size || null, color: color || null }
      ]
    });

    if (existingItem) {
      // Update quantity
      existingItem.quantity += createCartDto.quantity || 1;
      existingItem.updatedAt = new Date();
      return existingItem.save();
    } else {
      // Create new item
      const cartItem = new this.cartModel({
        ...createCartDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return cartItem.save();
    }
  }

  async findAll(): Promise<CartItem[]> {
    return this.cartModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<CartItem | null> {
    return this.cartModel.findById(id).exec();
  }

  async findBySession(sessionId: string): Promise<CartItem[]> {
    return this.cartModel
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUser(userId: string): Promise<CartItem[]> {
    return this.cartModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findBySessionOrUser(sessionId?: string, userId?: string): Promise<CartItem[]> {
    if (sessionId) {
      return this.cartModel
        .find({ sessionId })
        .sort({ createdAt: -1 })
        .exec();
    }

    if (userId) {
      return this.cartModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .exec();
    }

    return [];
  }

  async update(id: string, updateCartDto: UpdateCartDto): Promise<CartItem | null> {
    return this.cartModel.findByIdAndUpdate(
      id,
      { ...updateCartDto, updatedAt: new Date() },
      { new: true }
    ).exec();
  }

  async updateQuantity(id: string, quantity: number): Promise<CartItem | null> {
    return this.cartModel.findByIdAndUpdate(
      id,
      { quantity, updatedAt: new Date() },
      { new: true }
    ).exec();
  }

  async remove(id: string): Promise<CartItem | null> {
    return this.cartModel.findByIdAndDelete(id).exec();
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.cartModel.deleteMany({ sessionId });
  }

  async clearUser(userId: string): Promise<void> {
    await this.cartModel.deleteMany({ userId });
  }

  async mergeCart(sessionId: string, userId: string): Promise<void> {
    // Get anonymous cart items
    const anonymousItems = await this.cartModel.find({ sessionId });
    
    for (const item of anonymousItems) {
      // Check if same item exists for user
      const existingUserItem = await this.cartModel.findOne({
        userId,
        productId: item.productId,
        size: item.size,
        color: item.color
      });

      if (existingUserItem) {
        // Merge quantities
        existingUserItem.quantity += item.quantity;
        existingUserItem.updatedAt = new Date();
        await existingUserItem.save();
        // Delete anonymous item
        await this.cartModel.findByIdAndDelete(item._id);
      } else {
        // Transfer to user
        await this.cartModel.findByIdAndUpdate(
          item._id,
          { 
            userId: userId,
            sessionId: undefined,
            updatedAt: new Date()
          },
          { new: true }
        );
      }
    }
  }

  async getCartTotal(sessionId?: string, userId?: string): Promise<number> {
    const items = await this.findBySessionOrUser(sessionId, userId);
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}
