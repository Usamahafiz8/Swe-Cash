import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminUsersService } from './admin-users.service';
import { PayoutsService } from '../payouts/payouts.service';
import { FraudService } from '../fraud/fraud.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendNotificationDto } from '../notifications/dto/send-notification.dto';
import { CurrencyService } from '../currency/currency.service';
import { CreateCurrencyDto, UpdateCurrencyDto } from '../currency/dto/currency.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import {
  AdminListQueryDto,
  AdminPayoutListQueryDto,
  AdjustBalanceDto,
  UpdateUserStatusDto,
  PayoutActionDto,
  UpdateSettingDto,
} from './dto/admin-actions.dto';
import { CurrentAdmin } from './guards/current-admin.decorator';
import { RequestAdmin } from './guards/admin-jwt.strategy';

// ─── Auth ─────────────────────────────────────────────────────────────────────
@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly authService: AdminAuthService,
    private readonly usersService: AdminUsersService,
    private readonly payoutsService: PayoutsService,
    private readonly fraudService: FraudService,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly currencyService: CurrencyService,
  ) {}

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login — returns JWT' })
  @ApiOkResponse({ description: 'Access token for admin dashboard' })
  login(@Body() dto: AdminLoginDto) {
    return this.authService.login(dto);
  }

  // ─── Users ──────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Get('users')
  @ApiOperation({ summary: 'List all users with pagination and filters' })
  listUsers(@Query() query: AdminListQueryDto) {
    return this.usersService.listUsers(query);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Get('users/:id')
  @ApiOperation({ summary: 'Get full user detail including wallet and transactions' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  getUserDetail(@Param('id') id: string) {
    return this.usersService.getUserDetail(id);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update user account status (active / suspended / banned)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentAdmin() admin: RequestAdmin,
  ) {
    return this.usersService.updateStatus(id, dto, admin.id);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Post('users/:id/balance-adjust')
  @ApiOperation({ summary: 'Manually adjust user wallet balance (positive = credit, negative = debit)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  adjustBalance(
    @Param('id') id: string,
    @Body() dto: AdjustBalanceDto,
    @CurrentAdmin() admin: RequestAdmin,
  ) {
    return this.usersService.adjustBalance(id, dto, admin.id);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Get('users/:id/fraud-logs')
  @ApiOperation({ summary: 'Get all fraud logs for a specific user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  getUserFraudLogs(@Param('id') id: string) {
    return this.fraudService.getLogsForUser(id);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Patch('users/:id/fraud-escalate')
  @ApiOperation({ summary: 'Escalate user to blocked fraud status' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  escalateUser(@Param('id') id: string) {
    return this.fraudService.escalateToBlocked(id);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Get('fraud-logs')
  @ApiOperation({ summary: 'List fraud logs — filter by status (pending / reviewed / escalated / dismissed)' })
  listFraudLogs(@Query('status') status?: string) {
    return this.fraudService.listFraudLogs(status);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Patch('fraud-logs/:id/review')
  @ApiOperation({ summary: 'Mark a fraud log as reviewed with a verdict' })
  @ApiParam({ name: 'id', description: 'FraudLog UUID' })
  reviewFraudLog(@Param('id') id: string, @Body('status') status: string) {
    return this.fraudService.reviewLog(id, status);
  }

  // ─── Payouts ────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Get('payouts')
  @ApiOperation({ summary: 'List payouts with optional status/amount filters' })
  listPayouts(@Query() query: AdminPayoutListQueryDto) {
    return this.payoutsService.adminListPayouts(query);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Patch('payouts/:id/approve')
  @ApiOperation({ summary: 'Approve a pending payout — queues PayPal transfer' })
  @ApiParam({ name: 'id', description: 'Payout UUID' })
  approvePayout(
    @Param('id') id: string,
    @CurrentAdmin() admin: RequestAdmin,
  ) {
    return this.payoutsService.approvePayout(id, admin.email);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Patch('payouts/:id/reject')
  @ApiOperation({ summary: 'Reject a payout and restore user balance' })
  @ApiParam({ name: 'id', description: 'Payout UUID' })
  rejectPayout(@Param('id') id: string, @Body() dto: PayoutActionDto) {
    return this.payoutsService.rejectPayout(id, dto.adminNote ?? 'Rejected by admin');
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Patch('payouts/:id/freeze')
  @ApiOperation({ summary: 'Freeze a payout pending investigation' })
  @ApiParam({ name: 'id', description: 'Payout UUID' })
  freezePayout(@Param('id') id: string, @Body() dto: PayoutActionDto) {
    return this.payoutsService.freezePayout(id, dto.adminNote ?? 'Frozen by admin');
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Get('settings')
  @ApiOperation({ summary: 'Get all configurable settings (min payout, referral rates, etc.)' })
  getSettings() {
    return this.settingsService.getAll();
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Patch('settings/:key')
  @ApiOperation({ summary: 'Update a setting by key' })
  @ApiParam({ name: 'key', description: 'Setting key (e.g. min_payout_threshold)', example: 'min_payout_threshold' })
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentAdmin() admin: RequestAdmin,
  ) {
    await this.settingsService.set(key, dto.value, admin.email);
    return { message: `Setting "${key}" updated.` };
  }

  // ─── Notifications ──────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Post('notifications')
  @ApiOperation({ summary: 'Send or schedule a push notification to a target audience' })
  @ApiOkResponse({ description: 'Notification queued or scheduled' })
  sendNotification(
    @Body() dto: SendNotificationDto,
    @CurrentAdmin() admin: RequestAdmin,
  ) {
    return this.notificationsService.send(dto, admin.id);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Get('notifications')
  @ApiOperation({ summary: 'Get notification send history' })
  getNotificationHistory(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.notificationsService.getHistory(page, limit);
  }

  // ─── Currencies ──────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Get('currencies')
  @ApiOperation({ summary: 'List all currencies (enabled and disabled)' })
  listCurrencies() {
    return this.currencyService.listAll();
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Post('currencies')
  @ApiOperation({ summary: 'Add a new currency' })
  createCurrency(@Body() dto: CreateCurrencyDto) {
    return this.currencyService.create(dto);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Patch('currencies/:code')
  @ApiOperation({ summary: 'Update currency rate, symbol, name or enabled status' })
  @ApiParam({ name: 'code', description: 'ISO 4217 currency code', example: 'EUR' })
  updateCurrency(@Param('code') code: string, @Body() dto: UpdateCurrencyDto) {
    return this.currencyService.update(code, dto);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-jwt')
  @Delete('currencies/:code')
  @ApiOperation({ summary: 'Delete a currency (USD cannot be deleted)' })
  @ApiParam({ name: 'code', description: 'ISO 4217 currency code', example: 'SEK' })
  deleteCurrency(@Param('code') code: string) {
    return this.currencyService.remove(code);
  }
}
