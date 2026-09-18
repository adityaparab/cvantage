import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  MONGODB_DATABASE: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .default('cvantage'),
  SESSION_SECRET: z.string().min(32),
  LITELLM_BASE_URL: z.url().default('https://aigateway.adityaparab.info/v1'),
  LITELLM_API_KEY: z.string().min(1),
  LITELLM_WORKER_MODEL: z.string().min(1),
  LITELLM_JUDGE_MODEL: z.string().min(1),
});
export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: unknown): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const keys = [
      ...new Set(result.error.issues.map((issue) => issue.path.join('.'))),
    ];
    throw new Error(`Invalid environment configuration: ${keys.join(', ')}`);
  }
  const url = new URL(result.data.LITELLM_BASE_URL);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error('Invalid environment configuration: LITELLM_BASE_URL');
  }
  if (result.data.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('Production LITELLM_BASE_URL must use HTTPS');
  }
  return result.data;
}

@Injectable()
export class AppConfig {
  readonly values: Environment;
  constructor(config: ConfigService) {
    this.values = validateEnvironment(
      Object.fromEntries(
        Object.keys(environmentSchema.shape).map((key) => [
          key,
          config.get<unknown>(key),
        ]),
      ),
    );
  }
}
