import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('wallet')
  getWallet(@CurrentUser() user: RequestUser) {
    return this.walletService.getWallet(user.id);
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser() user: RequestUser,
    @Query() query: TransactionsQueryDto,
  ) {
    return this.walletService.getTransactions(user.id, query);
  }
}
