import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { TransferDto } from './dto/transfer.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
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

  @Get('history')
  @ApiOperation({ summary: 'Unified activity history — all earnings + payouts in one feed (use this for the History screen)' })
  @ApiOkResponse({
    description: 'Merged and sorted list of transactions and payouts. Filter by status: all | pending | approved | rejected',
  })
  getHistory(@CurrentUser() user: RequestUser, @Query() query: HistoryQueryDto) {
    return this.walletService.getHistory(user.id, query);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Raw ledger entries (internal use — use /history for the History screen UI)' })
  @ApiOkResponse({ description: 'Paginated ledger entries' })
  getTransactions(
    @CurrentUser() user: RequestUser,
    @Query() query: TransactionsQueryDto,
  ) {
    return this.walletService.getTransactions(user.id, query);
  }
}
