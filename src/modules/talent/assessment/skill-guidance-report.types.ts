import { z } from 'zod';
import { VerifiedLevel } from '../../assessments/entities';

export type SkillGuidanceReportJobData = {
  attemptId: string;
  track: string;
  claimed_level: VerifiedLevel;
  validated_level: VerifiedLevel;
  percentage: number;
};

export const skillGuidanceReportJobSchema = z.object({
  attemptId: z.string().uuid(),
  track: z.string(),
  claimed_level: z.nativeEnum(VerifiedLevel),
  validated_level: z.nativeEnum(VerifiedLevel),
  percentage: z.number(),
});
