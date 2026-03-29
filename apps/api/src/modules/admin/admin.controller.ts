import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminUsersService } from './admin-users.service';
import { PayoutsService } from '../payouts/payouts.service';
import { FraudService } from '../fraud/fraud.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendNotificationDto } from '../notifications/dto/send-notification.dto';
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
@Controller('admin')
export class AdminController {
  constructor(
    private readonly authService: AdminAuthService,
    private readonly usersService: AdminUsersService,
    private readonly payoutsService: PayoutsService,
    private readonly fraudService: FraudService,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AdminLoginDto) {
    return this.authService.login(dto);
  }

  // ─── Users ──────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @Get('users')
  listUsers(@Query() query: AdminListQueryDto) {
    return this.usersService.listUsers(query);
  }

  @UseGuards(AdminJwtGuard)
  @Get('users/:id')
  getUserDetail(@Param('id') id: string) {
    return this.usersService.getUserDetail(id);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentAdmin() admin: RequestAdmin,
  ) {
    return this.usersService.updateStatus(id, dto, admin.id);
  }

  @UseGuards(AdminJwtGuard)
  @Post('users/:id/balance-adjust')
  adjustBalance(
    @Param('id') id: string,
    @Body() dto: AdjustBalanceDto,
    @CurrentAdmin() admin: RequestAdmin,
  ) {
    return this.usersService.adjustBalance(id, dto, admin.id);
  }

  @UseGuards(AdminJwtGuard)
  @Get('users/:id/fraud-logs')
  getUserFraudLogs(@Param('id') id: string) {
    return this.fraudService.getLogsForUser(id);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('users/:id/fraud-escalate')
  escalateUser(@Param('id') id: string) {
    return this.fraudService.escalateToBlocked(id);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('fraud-logs/:id/review')
  reviewFraudLog(@Param('id') id: string, @Body('verdict') verdict: string) {
    return this.fraudService.reviewLog(id, verdict);
  }

  // ─── Payouts ────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @Get('payouts')
  listPayouts(@Query() query: AdminPayoutListQueryDto) {
    return this.payoutsService.adminListPayouts(query);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('payouts/:id/approve')
  approvePayout(
    @Param('id') id: string,
    @CurrentAdmin() admin: RequestAdmin,
  ) {
    return this.payoutsService.approvePayout(id, admin.email);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('payouts/:id/reject')
  rejectPayout(@Param('id') id: string, @Body() dto: PayoutActionDto) {
    return this.payoutsService.rejectPayout(id, dto.adminNote ?? 'Rejected by admin');
  }

  @UseGuards(AdminJwtGuard)
  @Patch('payouts/:id/freeze')
  freezePayout(@Param('id') id: string, @Body() dto: PayoutActionDto) {
    return this.payoutsService.freezePayout(id, dto.adminNote ?? 'Frozen by admin');
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @Get('settings')
  getSettings() {
    return this.settingsService.getAll();
  }

  // ─── Notifications ──────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @Post('notifications')
  sendNotification(
    @Body() dto: SendNotificationDto,
    @CurrentAdmin() admin: RequestAdmin,
  ) {
    return this.notificationsService.send(dto, admin.id);
  }

  @UseGuards(AdminJwtGuard)
  @Get('notifications')
  getNotificationHistory(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.notificationsService.getHistory(page, limit);
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @Patch('settings/:key')
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentAdmin() admin: RequestAdmin,
  ) {
    await this.settingsService.set(key, dto.value, admin.email);
    return { message: `Setting "${key}" updated.` };
  }
}
