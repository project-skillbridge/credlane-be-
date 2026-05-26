import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  NOTIFICATION_TYPE_VALUES,
  NotificationType,
} from '../notification-type.enum';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class NotificationItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: NOTIFICATION_TYPE_VALUES })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ required: false, nullable: true })
  data: Record<string, unknown> | null;

  @ApiProperty()
  is_read: boolean;

  @ApiProperty({ required: false, nullable: true })
  read_at: string | null;

  @ApiProperty()
  created_at: string;
}

export class NotificationsListResponseDto {
  @ApiProperty({ type: [NotificationItemDto] })
  items: NotificationItemDto[];
}

export class UnreadCountResponseDto {
  @ApiProperty({ example: 3 })
  unread_count: number;
}
