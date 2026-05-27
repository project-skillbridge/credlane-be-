import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum IntegrityEventType {
  TAB_SWITCH = 'tab_switch',
  COPY_PASTE = 'copy_paste',
}

export class FlagIntegrityEventDto {
  @ApiProperty({ enum: IntegrityEventType })
  @IsEnum(IntegrityEventType)
  eventType: IntegrityEventType;

  @ApiProperty({ required: false, description: 'Additional context' })
  @IsOptional()
  @IsString()
  context?: string;
}

export interface IntegrityFlagResult {
  status: string;
  message: string;
  tabSwitchCount?: number;
  copyPasteCount?: number;
  sessionVoided?: boolean;
  action?: 'warn' | 'logout';
}
