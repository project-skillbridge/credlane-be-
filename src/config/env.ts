import { createEnv } from '@t3-oss/env-core';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { parseDurationToMs } from '../shared/runtime/duration';

dotenv.config();

const booleanString = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

const durationString = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .transform((value) => {
      parseDurationToMs(value);
      return value;
    });

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_HOST: z.string().min(1),
    DATABASE_PORT: z.coerce.number().int().positive().default(5432),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string(),
    DATABASE_NAME: z.string().min(1),
    DATABASE_SYNC: booleanString.default(false),
    DATABASE_LOGGING: booleanString.default(false),
    DATABASE_SSL: booleanString.default(false),
    DATABASE_SSL_CA: z.string().optional(),

    REDIS_URL: z.string().url().optional(),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_ACCESS_EXPIRES_IN: durationString('15m'),
    ADMIN_JWT_ACCESS_EXPIRES_IN: durationString('8h'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    JWT_REFRESH_EXPIRES_IN: durationString('7d'),
    VERIFICATION_OTP_EXPIRES_IN: durationString('5m'),
    VERIFICATION_RESEND_LIMIT_PER_HOUR: z.coerce
      .number()
      .int()
      .positive()
      .default(3),

    PASSWORD_RESET_OTP_EXPIRES_IN: durationString('5m'),
    /** Max forgot-password requests allowed per account within a 1-hour rolling window. */
    PASSWORD_RESET_RATE_LIMIT_PER_HOUR: z.coerce
      .number()
      .int()
      .positive()
      .default(5),

    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    AUTH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).optional(),
    SWAGGER_ENABLED: booleanString.default(true),
    RESEND_API_KEY: z.string().min(1),
    RESEND_MAIL_FROM: z.email(),
    SEED_ADMIN_EMAIL: z.email().default('admin@example.com'),
    SEED_ADMIN_PASSWORD: z.string().min(12).default('Admin@123456'),
    SEED_ADMIN_FULL_NAME: z.string().min(1).default('Admin User'),
    // JSON array of additional admins: '[{"email":"...","password":"...","full_name":"...","admin_tier":"ADMIN"}]'
    SEED_ADMINS: z.string().optional(),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_CALLBACK_URL: z.string().min(1),
    GOOGLE_DEFAULT_COUNTRY: z.string().default('Unknown'),

    FRONTEND_URL: z.string().default('http://localhost:5173'),
    EMAIL_LOGO_URL: z.string().url().optional(),
    EMAIL_LOGO_WHITE_URL: z.string().url().optional(),
    SUPPORT_EMAIL: z.email().default('support@skillbridge.com'),

    /**
     * Comma-separated content team emails notified on BANK_EXHAUSTED (503).
     * Each token is validated as an email address at startup.
     */
    CONTENT_TEAM_BANK_ALERT_EMAILS: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val?.trim()) return true;
          return val
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
            .every((t) => z.string().email().safeParse(t).success);
        },
        {
          message:
            'CONTENT_TEAM_BANK_ALERT_EMAILS must be a comma-separated list of valid email addresses',
        },
      ),

    AWS_REGION: z.string().optional(),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_ENDPOINT: z.string().url().optional(),
    AWS_PUBLIC_URL: z.string().url().optional(),

    OPENROUTER_API_KEY: z.string().min(1).optional(),
    OPENROUTER_PROVIDER: z.enum(['openrouter', 'nvidia']).default('openrouter'),
    OPENROUTER_MODEL: z.string().default('openai/gpt-oss-120b:free'),
    OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),

    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),

    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().default('gemini-3.5-flash'),

    YOUTUBE_API_KEY: z.string().min(1).optional(),
    SERPER_API_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type Env = typeof env;
