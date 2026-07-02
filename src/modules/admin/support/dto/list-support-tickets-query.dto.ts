import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../users/dto/pagination.dto';
import {
  SUPPORT_TICKET_STATUS_VALUES,
  SUPPORT_TICKET_TYPE_VALUES,
  SupportTicketStatus,
  SupportTicketType,
} from '../entities/support-ticket.entity';

export class ListSupportTicketsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: SUPPORT_TICKET_STATUS_VALUES,
    example: SupportTicketStatus.OPEN,
  })
  @IsOptional()
  @IsIn(SUPPORT_TICKET_STATUS_VALUES)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({
    enum: SUPPORT_TICKET_TYPE_VALUES,
    example: SupportTicketType.TECHNICAL,
  })
  @IsOptional()
  @IsIn(SUPPORT_TICKET_TYPE_VALUES)
  type?: SupportTicketType;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Search by submitter name',
    example: 'Tina',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
