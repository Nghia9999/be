import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  Request,
  Query 
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  async addToCart(@Body() createCartDto: CreateCartDto) {
    return this.cartService.create(createCartDto);
  }

  @Get()
  async getCart(
    @Request() req,
    @Query('sessionId') sessionId?: string,
    @Query('userId') userIdQuery?: string,
  ) {
    const userId = req.user?.sub || userIdQuery;
    return this.cartService.findBySessionOrUser(sessionId, userId);
  }

  @Get('session/:sessionId')
  async getCartBySession(@Param('sessionId') sessionId: string) {
    return this.cartService.findBySession(sessionId);
  }

  @Get('user/:userId')
  async getCartByUser(@Param('userId') userId: string) {
    return this.cartService.findByUser(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.cartService.findOne(id);
  }

  @Patch(':id')
  async updateQuantity(
    @Param('id') id: string, 
    @Body('quantity') quantity: number
  ) {
    return this.cartService.updateQuantity(id, quantity);
  }

  @Patch(':id/full')
  async update(@Param('id') id: string, @Body() updateCartDto: UpdateCartDto) {
    return this.cartService.update(id, updateCartDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.cartService.remove(id);
  }

  @Delete('session/:sessionId')
  async clearSession(@Param('sessionId') sessionId: string) {
    await this.cartService.clearSession(sessionId);
    return { message: 'Cart cleared successfully' };
  }

  @Delete('user/:userId')
  async clearUser(@Param('userId') userId: string) {
    await this.cartService.clearUser(userId);
    return { message: 'Cart cleared successfully' };
  }

  @Post('merge')
  async mergeCart(@Body() body: { sessionId: string; userId: string }) {
    await this.cartService.mergeCart(body.sessionId, body.userId);
    return { message: 'Cart merged successfully' };
  }

  @Get('total')
  async getCartTotal(
    @Request() req,
    @Query('sessionId') sessionId?: string,
    @Query('userId') userIdQuery?: string,
  ) {
    const userId = req.user?.sub || userIdQuery;
    const total = await this.cartService.getCartTotal(sessionId, userId);
    return { total };
  }
}
