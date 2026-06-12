import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmployerNotificationLinkDto {
  @ApiProperty({ nullable: true })
  entity_id: string | null;

  @ApiProperty({
    nullable: true,
    enum: ['candidate', 'offer', 'assessment', 'discovery'],
  })
  entity_type: 'candidate' | 'offer' | 'assessment' | 'discovery' | null;
}

export class EmployerNotificationItemDto {
  @ApiProperty({ format: 'uuid' })
  notification_id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty()
  read: boolean;

  @ApiPropertyOptional({ type: EmployerNotificationLinkDto, nullable: true })
  link: EmployerNotificationLinkDto | null;

  @ApiPropertyOptional({ nullable: true })
  data: Record<string, unknown> | null;
}

export class EmployerNotificationsListResponseDto {
  @ApiProperty({ type: [EmployerNotificationItemDto] })
  items: EmployerNotificationItemDto[];
}
