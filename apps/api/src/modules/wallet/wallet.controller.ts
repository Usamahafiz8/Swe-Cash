import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
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
  @ApiOperation({ summary: 'Get wallet balances' })
  @ApiOkResponse({ description: 'available_balance, pending_balance, lifetime_earnings, lifetime_payouts' })
  getWallet(@CurrentUser() user: RequestUser) {
    return this.walletService.getWallet(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get paginated transaction history' })
  @ApiOkResponse({ description: 'Paginated ledger entries' })
  getTransactions(
    @CurrentUser() user: RequestUser,
    @Query() query: TransactionsQueryDto,
  ) {
    return this.walletService.getTransactions(user.id, query);
  }
}
