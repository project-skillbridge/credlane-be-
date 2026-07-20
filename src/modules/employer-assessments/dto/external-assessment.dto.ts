import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class RegisterExternalAssessmentDto {
  @ApiProperty({ example: 'candidate@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  consentedMarketing: boolean;
}

export class ExternalAssessmentAnswerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty()
  @IsString()
  answer: string;
}

export class ExternalAssessmentModuleResponseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @ApiProperty({ type: [ExternalAssessmentAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalAssessmentAnswerDto)
  answers: ExternalAssessmentAnswerDto[];
}

export class SubmitExternalAssessmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  externalApplicantId: string;

  @ApiProperty({ type: [ExternalAssessmentModuleResponseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalAssessmentModuleResponseDto)
  responses: ExternalAssessmentModuleResponseDto[];
}
