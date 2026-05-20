import { z } from 'zod';

const score = () => z.number().int().min(0).max(3);
const lt3Score = () => z.number().int().min(0).max(4);

export const rubricFullSchema = z.object({
  relevance: score(),
  reasoning: score(),
  specificity: score(),
  completeness: score(),
  total: z.number().int().min(0).max(12),
  feedback: z.string(),
});

// LT-3 reflection: 2 dimensions only, 0-4 per dimension, max 8.
export const rubricLt3Schema = z.object({
  relevance: lt3Score(),
  reasoning: lt3Score(),
  total: z.number().int().min(0).max(8),
  feedback: z.string(),
});

export const generatedQuestionSchema = z.object({
  question_text: z.string(),
  options: z.array(z.string()).nullable(),
  correct_answer: z.string().nullable(),
  competency: z.string().nullable(),
  industry_context: z.string().nullable(),
});

export const questionGenerationSchema = z.object({
  questions: z.array(generatedQuestionSchema),
});

export const personalAssessmentGeneratedQuestionSchema = z.object({
  source_key: z.string(),
  prompt: z.string(),
  helper_text: z.string().nullable(),
});

export const personalAssessmentGenerationSchema = z.object({
  questions: z.array(personalAssessmentGeneratedQuestionSchema).min(15).max(20),
});

export const lt3Schema = z.object({
  question_text: z.string(),
});

export const guidanceReportSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  improvement_areas: z.array(z.string()),
  recommended_resources: z.array(z.string()),
  retake_advice: z.string(),
});
