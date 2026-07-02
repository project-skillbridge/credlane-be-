import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  SUPPORT_TICKET_STATUS_VALUES,
  SupportTicketStatus,
} from '../entities/support-ticket.entity';

export class UpdateSupportTicketDto {
  @ApiPropertyOptional({
    enum: SUPPORT_TICKET_STATUS_VALUES,
    example: 'in_progress',
    description: 'Ticket status control shown in the detail panel.',
  })
  @IsOptional()
  @IsIn(SUPPORT_TICKET_STATUS_VALUES)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({
    example: 'e72574a3-6a7e-4202-9ab8-0246a98a3b2a',
    format: 'uuid',
    nullable: true,
    description:
      'Admin user to assign. Null clears assignment. Full scoping is deferred by OQ-02.',
  })
  @IsOptional()
  @IsUUID()
  assignedAdminId?: string | null;
}
