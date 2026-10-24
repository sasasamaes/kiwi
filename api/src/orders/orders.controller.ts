// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Public } from '../auth/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { ChatService } from '../chat/chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly chatService: ChatService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new order' })
  async create(
    @CurrentUser() user: any,
    @Body() createOrderDto: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const dto =
      idempotencyKey && !createOrderDto?.idempotencyKey
        ? { ...createOrderDto, idempotencyKey }
        : createOrderDto;
    return this.ordersService.create(user.sub, dto);
  }

  @Public()
  @Post('guest')
  @ApiOperation({ summary: 'Create a guest order from the public menu link (no auth)' })
  async createGuest(
    @Body() createOrderDto: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const dto =
      idempotencyKey && !createOrderDto?.idempotencyKey
        ? { ...createOrderDto, idempotencyKey }
        : createOrderDto;
    return this.ordersService.createGuestOrder(dto?.merchantId, dto);
  }

  @Post('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear pedido como cliente registrado (queda atado a mi cuenta)' })
  async createMine(
    @CurrentUser() user: any,
    @Body() createOrderDto: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const dto =
      idempotencyKey && !createOrderDto?.idempotencyKey
        ? { ...createOrderDto, idempotencyKey }
        : createOrderDto;
    return this.ordersService.createGuestOrder(dto?.merchantId, dto, user.sub);
  }

  @Post('encomienda')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Pedir una encomienda a un repartidor (cliente registrado, sin comercio)',
  })
  async createEncomienda(
    @CurrentUser() user: any,
    @Body() createOrderDto: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const dto =
      idempotencyKey && !createOrderDto?.idempotencyKey
        ? { ...createOrderDto, idempotencyKey }
        : createOrderDto;
    return this.ordersService.createEncomiendaOrder(user.sub, dto);
  }

  @Post('mandado')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Pedir un mandado (compra presencial) a un repartidor (cliente registrado)',
  })
  async createMandado(
    @CurrentUser() user: any,
    @Body() createOrderDto: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const dto =
      idempotencyKey && !createOrderDto?.idempotencyKey
        ? { ...createOrderDto, idempotencyKey }
        : createOrderDto;
    return this.ordersService.createMandadoOrder(user.sub, dto);
  }

  @Put(':id/receipt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar el monto de la factura de un mandado' })
  async setReceipt(
    @Param('id') id: string,
    @Body('amount') amount: unknown,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.setReceiptAmount(id, user.sub, amount);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my orders (merchant or driver)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiQuery({ name: 'skip', required: false })
  async getMyOrders(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    if (user.role === 'merchant') {
      return this.ordersService.findByMerchant(
        user.sub,
        status,
        take != null ? Number(take) : undefined,
        skip != null ? Number(skip) : undefined,
      );
    } else if (user.role === 'customer') {
      return this.ordersService.findByCustomer(
        user.sub,
        status,
        take != null ? Number(take) : undefined,
        skip != null ? Number(skip) : undefined,
      );
    } else {
      return this.ordersService.findByDriver(user.sub, status);
    }
  }

  @Get('incoming')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Comandas: pedidos activos que entraron por la app cliente' })
  async getIncoming(@CurrentUser() user: any) {
    return this.ordersService.findIncoming(user.sub);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available orders for drivers' })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'lng', required: false })
  @ApiQuery({ name: 'scheduled', required: false })
  async getAvailable(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('scheduled') scheduled?: string,
  ) {
    const latitude = lat ? parseFloat(lat) : undefined;
    const longitude = lng ? parseFloat(lng) : undefined;
    return this.ordersService.getAvailableOrders(latitude, longitude, {
      scheduled: scheduled === 'true',
    });
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all orders with stats (admin only)' })
  async listForAdmin(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.ordersService.listForAdmin({
      take: take != null ? Number(take) : undefined,
      skip: skip != null ? Number(skip) : undefined,
      status,
      search,
      driverId,
    });
  }

  @Get('admin/zone-mix')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mezcla real de zonas de pedidos entregados (para el simulador de ganancias)',
  })
  async getDeliveredZoneMix() {
    return this.ordersService.getDeliveredZoneMix();
  }

  @Get('admin/monthly-actuals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Ingresos reales por mes de pedidos entregados (reporte Real vs Proyección). Incluye last30: ventana móvil de los últimos 30 días.',
  })
  async getMonthlyActuals(@Query('months') months?: string) {
    const n = months != null ? Number(months) : 6;
    return this.ordersService.getMonthlyActuals(
      Number.isFinite(n) && n >= 1 && n <= 24 ? Math.floor(n) : 6,
    );
  }

  @Public()
  @Get('track/:id')
  @ApiOperation({ summary: 'Public order tracking (share link, no auth)' })
  async trackOrder(@Param('id') id: string) {
    return this.ordersService.getPublicTracking(id);
  }

  @Public()
  @Get('track/:id/location')
  @ApiOperation({ summary: 'Public driver location for a tracked order (no auth)' })
  async trackDriverLocation(@Param('id') id: string) {
    return this.ordersService.getPublicDriverLocation(id);
  }

  @Get('duplicates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aviso de posible duplicado: pedido activo parecido reciente' })
  @ApiQuery({ name: 'deliveryAddress', required: true })
  async checkDuplicate(
    @CurrentUser() user: any,
    @Query('deliveryAddress') deliveryAddress?: string,
  ) {
    return this.ordersService.findPossibleDuplicate(user.sub, String(deliveryAddress ?? ''));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.findById(id, user.sub, user.role);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
    @Body('proofPhotoUrl') proofPhotoUrl?: string,
  ) {
    return this.ordersService.updateStatus(id, status, user.sub, user.role, proofPhotoUrl);
  }

  @Post(':id/proof-photo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload order proof photo (pickup or delivery)' })
  async uploadProofPhoto(
    @Param('id') id: string,
    @Body('kind') kind: 'pickup' | 'delivery',
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.uploadProofPhotoWithFile(id, kind, file, user.sub);
  }

  @Get(':id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Order chat history (participants only)' })
  @ApiQuery({ name: 'limit', required: false })
  async getMessages(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getMessages(id, user.sub, limit ? Number(limit) : 50);
  }

  @Post(':id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send order chat message (participants only)' })
  async sendMessage(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.chatService.sendMessage(id, user.sub, user.role, body?.text);
  }

  @Put(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign driver to order' })
  async assignDriver(
    @Param('id') id: string,
    @Body('driverId') driverId: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.assignDriver(id, driverId, user.sub);
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Driver accepts a pending order' })
  async acceptOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.acceptOrderAsDriver(id, user.sub);
  }

  @Post(':id/accept-assignment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assigned driver accepts within the acceptance window' })
  async acceptAssignment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.acceptAssignment(id, user.sub);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Assigned driver rejects the order back to contest (notifies merchant)',
  })
  async rejectOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.rejectOrderAsDriver(id, user.sub);
  }

  @Put(':id/reassign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin reassigns an active order to another driver' })
  async reassignDriver(
    @Param('id') id: string,
    @Body('driverId') driverId: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.reassignDriver(id, driverId, user.sub);
  }

  @Post(':id/proposals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit proposal for scheduled order' })
  async submitProposal(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() proposalDto: any,
  ) {
    return this.ordersService.submitProposal(id, user.sub, proposalDto);
  }

  @Put(':orderId/proposals/:proposalId/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept driver proposal' })
  async acceptProposal(
    @Param('orderId') orderId: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.acceptProposal(orderId, proposalId, user.sub);
  }
}
