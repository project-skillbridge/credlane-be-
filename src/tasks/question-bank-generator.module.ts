import { Module } from '@nestjs/common';
import { AiModule } from '../modules/ai/ai.module';
import { MailModule } from '../modules/mail/mail.module';
import { QuestionBankGeneratorService } from './question-bank-generator.service';

@Module({
  imports: [AiModule, MailModule],
  providers: [QuestionBankGeneratorService],
  exports: [QuestionBankGeneratorService],
})
export class QuestionBankGeneratorModule {}
