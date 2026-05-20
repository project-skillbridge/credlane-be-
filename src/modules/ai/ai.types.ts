import { QuestionType, SlotType, VerifiedLevel } from '../assessments/entities/assessment-question.entity';

// ── Rubric scoring ────────────────────────────────────────────────────────────

export interface RubricDimensions {
  relevance: number;    // 0–3 (0–4 for LT-3)
  reasoning: number;    // 0–3 (0–4 for LT-3)
  specificity: number;  // 0–3, always 0 for LT-3
  completeness: number; // 0–3, always 0 for LT-3
}

export interface RubricScore extends RubricDimensions {
  total: number;        // sum of dimensions (max 12, or max 8 for LT-3)
  feedback: string;     // one-sentence rationale
  pending?: boolean;    // true when AI failed and a backfill should re-score this answer
}

export interface TextAnswerInput {
  question_id: string;
  question_text: string;
  answer: string;
  // LT-3 (reflection) is scored on Relevance + Reasoning only, 0–4 each, max 8.
  is_lt3?: boolean;
}

export interface ScoredTextAnswer {
  question_id: string;
  rubric: RubricScore;
  raw_score: number;
  max_score: number;
}

// ── Question generation ───────────────────────────────────────────────────────

export interface GenerateQuestionsInput {
  track: string;
  verified_level: VerifiedLevel;
  assessment_type: 'skill' | 'advanced';
  question_type: QuestionType;
  slot_type?: SlotType;
  competency?: string;
  industry_context?: string;
  count: number;
}

export interface GeneratedQuestion {
  question_text: string;
  question_type: QuestionType;
  slot_type: SlotType | null;
  options: string[] | null;       // MCQ only
  correct_answer: string | null;  // MCQ only
  competency: string | null;
  industry_context: string | null;
}

// ── LT-3 conditional generation ──────────────────────────────────────────────

export interface GenerateLt3Input {
  track: string;
  verified_level: VerifiedLevel;
  lt2_question_text: string;
  lt2_answer: string;
}

export interface GeneratedLt3Question {
  question_text: string;
}

// ── Guidance report ───────────────────────────────────────────────────────────

export interface GuidanceReportInput {
  track: string;
  claimed_level: VerifiedLevel;
  validated_level: VerifiedLevel;
  percentage: number;
  strong_competencies: string[];
  weak_competencies: string[];
}

export interface GuidanceReport {
  summary: string;
  strengths: string[];
  improvement_areas: string[];
  recommended_resources: string[];
  retake_advice: string;
}
