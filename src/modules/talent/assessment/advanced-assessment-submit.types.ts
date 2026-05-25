import { z } from 'zod';

export type AdvancedAssessmentSubmitAnswer = {
  question_id: string;
  answer: string | string[];
  time_spent_seconds?: number;
};

export type AdvancedAssessmentSubmitJobData = {
  userId: string;
  sessionId: string;
  answers: AdvancedAssessmentSubmitAnswer[];
};

const submitAnswerSchema = z.object({
  question_id: z.string().uuid(),
  answer: z.union([z.string(), z.array(z.string())]),
  time_spent_seconds: z.number().optional(),
});

export const advancedAssessmentSubmitJobSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  answers: z.array(submitAnswerSchema),
});
