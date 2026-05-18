import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { TransferDto } from './dto/transfer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Wallet')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('wallet')
  @ApiOperation({ summary: 'Get wallet balances + target reward progress' })
  @ApiOkResponse({ description: 'available_balance, pending_balance, lifetime_earnings, targetRewardUsd, targetRewardProgress' })
  getWallet(@CurrentUser() user: RequestUser) {
    return this.walletService.getWallet(user.id);
  }

  @Post('wallet/transfer')
  @ApiOperation({ summary: 'Transfer balance to another user by their referral code' })
  @ApiOkResponse({ description: 'Transfer successful — both wallets updated instantly' })
  transfer(@CurrentUser() user: RequestUser, @Body() dto: TransferDto) {
    return this.walletService.transfer(user.id, dto.recipientCode, dto.amount);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get paginated transaction history' })
  @ApiOkResponse({ description: 'Paginated ledger entries — includes transfer_in, transfer_out, adjoe_reward, ad_reward, referral_reward, bonus, payout_request' })
  getTransactions(
    @CurrentUser() user: RequestUser,
    @Query() query: TransactionsQueryDto,
  ) {
    return this.walletService.getTransactions(user.id, query);
  }
}
