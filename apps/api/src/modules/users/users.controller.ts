import { Controller, Get, Post, Delete, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('User')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiOkResponse({ description: 'User profile with wallet' })
  getProfile(@CurrentUser() user: RequestUser) {
    return this.usersService.getProfile(user.id);
  }

  @Post('update')
  @ApiOperation({ summary: 'Update country or FCM token' })
  @ApiOkResponse({ description: 'Updated profile' })
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Delete('account')
  @ApiOperation({
    summary:
      'Permanently delete account (App Store compliance). Anonymises PII and forfeits any ' +
      'remaining balance; financial records kept for legal audit.',
  })
  @ApiOkResponse({ description: 'Account deleted' })
  @ApiResponse({
    status: 400,
    description:
      'Withdrawable balance exists (at or above the payout minimum). Retry with ' +
      'forfeitBalance=true to confirm giving it up.',
  })
  deleteAccount(@CurrentUser() user: RequestUser, @Query() dto: DeleteAccountDto) {
    return this.usersService.deleteAccount(user.id, dto);
  }
}
