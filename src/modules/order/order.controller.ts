import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards,
  Request 
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller('orders') // Changed to plural
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    // Add userId from authenticated user if available
    return this.orderService.create({
      ...createOrderDto,
      userId: req.user?.sub || 'anonymous',
    });
  }

  @Get()
  getUserOrders(@Request() req) {
    if (req.user?.sub) {
      return this.orderService.findByUserId(req.user.sub);
    }
    return this.orderService.findAll();
  }

  @Get('admin/all')
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
