import { Global, Module } from '@nestjs/common';
import { BankExhaustedAlertService } from './bank-exhausted-alert.service';
import { MailService } from './mail.service';
import { OutboundEmailQueueService } from './outbound-email-queue.service';

@Global()
@Module({
  providers: [
    OutboundEmailQueueService,
    MailService,
    BankExhaustedAlertService,
  ],
  exports: [MailService, BankExhaustedAlertService],
})
export class MailModule {}
