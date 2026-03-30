import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Roles } from '../../common/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('orders') // Changed to plural
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto, @Request() req: { user?: { id: string } }) {
    const userId = req.user?.id ?? (req.user as any)?.sub;
    if (!userId) {
      throw new UnauthorizedException('Bạn cần đăng nhập để tạo đơn hàng');
    }
    return this.orderService.create({
      ...createOrderDto,
      userId,
    });
  }

  @Get()
  getUserOrders(@Request() req: { user?: { id: string } }) {
    const userId = req.user?.id ?? (req.user as any)?.sub;
    if (!userId) {
      throw new UnauthorizedException('Bạn cần đăng nhập để xem lịch sử đơn hàng');
    }
    return this.orderService.findByUserId(userId);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.orderService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: { user?: { id?: string; sub?: string; role?: string } }) {
    const order = await this.orderService.findOne(id);
    if (!order) return null;
    const userId = req.user?.id ?? req.user?.sub;
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && order.userId !== userId) {
      throw new UnauthorizedException('Bạn không có quyền xem đơn hàng này');
    }
    return order;
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string, 
    @Body('status') status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  ) {
    return this.orderService.updateStatus(id, status);
  }

  @Patch(':id/payment')
  updatePaymentStatus(
    @Param('id') id: string, 
    @Body('paymentStatus') paymentStatus: 'pending' | 'paid' | 'failed'
  ) {
    return this.orderService.updatePaymentStatus(id, paymentStatus);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req: { user?: { id?: string; sub?: string; role?: string } }) {
    const order = await this.orderService.findOne(id);
    if (!order) throw new UnauthorizedException('Đơn hàng không tồn tại');
    const userId = req.user?.id ?? req.user?.sub;
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && order.userId !== userId) {
      throw new UnauthorizedException('Bạn không có quyền hủy đơn hàng này');
    }
    return this.orderService.cancel(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orderService.remove(id);
  }
}
