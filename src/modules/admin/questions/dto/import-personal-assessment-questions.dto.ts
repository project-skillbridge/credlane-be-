import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { buildVariantQuestionId } from '../../../talent/assessment/personal-assessment-import.ids';

export const PERSONAL_ASSESSMENT_IMPORT_FORMATS = [
  'single_select',
  'multi_select',
  'text_required',
  'text_optional',
] as const;

@ValidatorConstraint({ name: 'trackVariantsShape', async: false })
class TrackVariantsShapeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value == null) {
      return true;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const item = args.object as PersonalAssessmentQuestionImportItemDto;
    const baseId = typeof item.id === 'string' ? item.id : '';

    return Object.entries(value as Record<string, unknown>).every(
      ([roleCode, entry]) => {
        try {
          buildVariantQuestionId(baseId, roleCode);
        } catch {
          return false;
        }

        return TrackVariantsShapeConstraint.isValidVariantEntry(entry);
      },
    );
  }

  private static isValidVariantEntry(entry: unknown): boolean {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return false;
    }
    const options = (entry as { options?: unknown }).options;
    if (!Array.isArray(options) || options.length === 0) {
      return false;
    }
    return options.every((option) => {
      if (!option || typeof option !== 'object' || Array.isArray(option)) {
        return false;
      }
      const { value: optionValue, label } = option as {
        value?: unknown;
        label?: unknown;
      };
      return (
        typeof optionValue === 'string' &&
        optionValue.length > 0 &&
        typeof label === 'string' &&
        label.length > 0
      );
    });
  }

  defaultMessage(): string {
    return 'Each track variant must have a valid role code and options array that fit within id limits';
  }
}

@ValidatorConstraint({ name: 'selectOptionsOrTrackVariants', async: false })
class SelectOptionsOrTrackVariantsConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const item = args.object as PersonalAssessmentQuestionImportItemDto;
    if (!['single_select', 'multi_select'].includes(item.format)) {
      return true;
    }
    const hasOptions = Array.isArray(item.options) && item.options.length > 0;
    const hasVariants =
      item.trackVariants != null && Object.keys(item.trackVariants).length > 0;
    return hasOptions || hasVariants;
  }

  defaultMessage(): string {
    return 'Either options or trackVariants is required for select questions';
  }
}

export class PersonalAssessmentQuestionOptionDto {
  @ApiProperty({ example: 'fully_remote' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ example: 'Fully remote, no office' })
  @IsString()
  @IsNotEmpty()
  label: string;
}

export class PersonalAssessmentTrackVariantDto {
  @ApiProperty({ type: [PersonalAssessmentQuestionOptionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PersonalAssessmentQuestionOptionDto)
  options: PersonalAssessmentQuestionOptionDto[];
}

export class PersonalAssessmentQuestionImportItemDto {
  @Validate(SelectOptionsOrTrackVariantsConstraint)
  @ApiProperty({ example: 'PA-GEN-WST-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  id: string;

  @ApiProperty({ example: 'work_style' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  section: string;

  @ApiProperty({ example: 'all' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  track: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ example: 'work_arrangement', name: 'field_name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fieldName: string;

  @ApiProperty({
    example: 'single_select',
    enum: PERSONAL_ASSESSMENT_IMPORT_FORMATS,
  })
  @IsIn([...PERSONAL_ASSESSMENT_IMPORT_FORMATS])
  format: (typeof PERSONAL_ASSESSMENT_IMPORT_FORMATS)[number];

  @ApiProperty({ example: true })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({
    description: 'Admin note from question bank JSON (not persisted)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ type: [PersonalAssessmentQuestionOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PersonalAssessmentQuestionOptionDto)
  options?: PersonalAssessmentQuestionOptionDto[];

  @ApiPropertyOptional({
    name: 'track_variants',
    description:
      'Per-track option sets keyed by 3-letter role code (e.g. FED, PMG). Imported as one row per track.',
    type: 'object',
    additionalProperties: { type: 'object' },
  })
  @IsOptional()
  @IsObject()
  @Validate(TrackVariantsShapeConstraint)
  trackVariants?: Record<string, PersonalAssessmentTrackVariantDto>;
}

export class ImportPersonalAssessmentQuestionsDto {
  @ApiProperty({ type: [PersonalAssessmentQuestionImportItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PersonalAssessmentQuestionImportItemDto)
  questions: PersonalAssessmentQuestionImportItemDto[];
}
