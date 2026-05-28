import { z } from 'zod';

export type AdvancedAssessmentSubmitAnswer = {
  questionId: string;
  answer: string | string[];
  timeSpentSeconds?: number;
};

export type AdvancedAssessmentSubmitJobData = {
  userId: string;
  sessionId: string;
  answers: AdvancedAssessmentSubmitAnswer[];
};

const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.union([z.string(), z.array(z.string())]),
  timeSpentSeconds: z.number().optional(),
});

export const advancedAssessmentSubmitJobSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  answers: z.array(submitAnswerSchema),
});
