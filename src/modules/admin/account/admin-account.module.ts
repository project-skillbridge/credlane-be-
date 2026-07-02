import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { AdminAccountController } from './admin-account.controller';
import { AdminAccountService } from './admin-account.service';

@Module({
  imports: [UsersModule],
  controllers: [AdminAccountController],
  providers: [AdminAccountService],
})
export class AdminAccountModule {}
