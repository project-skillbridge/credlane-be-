import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployerPackage } from './entities/employer-package.entity';
import { EmployerSubscription } from './entities/employer-subscription.entity';
import { TalentSubscription } from './entities/talent-subscription.entity';
import { Transaction } from './entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployerPackage,
      EmployerSubscription,
      TalentSubscription,
      Transaction,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class PaymentsModule {}
