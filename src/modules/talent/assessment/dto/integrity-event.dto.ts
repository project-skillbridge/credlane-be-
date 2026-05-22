import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum IntegrityEventType {
  TAB_SWITCH = 'tab_switch',
  COPY_PASTE = 'copy_paste',
}

export class FlagIntegrityEventDto {
  @ApiProperty({ enum: IntegrityEventType })
  @IsEnum(IntegrityEventType)
  event_type: IntegrityEventType;

  @ApiProperty({ required: false, description: 'Additional context' })
  @IsOptional()
  @IsString()
  context?: string;
}

export interface IntegrityFlagResult {
  status: string;
  message: string;
  tab_switch_count?: number;
  copy_paste_count?: number;
  session_voided?: boolean;
  action?: 'warn' | 'logout';
}
