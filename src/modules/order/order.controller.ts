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
  create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    if (!req.user?.sub) {
      throw new UnauthorizedException('Bạn cần đăng nhập để tạo đơn hàng');
    }

    return this.orderService.create({
      ...createOrderDto,
      userId: req.user.sub,
    });
  }

  @Get()
  getUserOrders(@Request() req) {
    if (!req.user?.sub) {
      throw new UnauthorizedException('Bạn cần đăng nhập để xem lịch sử đơn hàng');
    }
    return this.orderService.findByUserId(req.user.sub);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.orderService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
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
  cancel(@Param('id') id: string) {
    return this.orderService.cancel(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orderService.remove(id);
  }
}
