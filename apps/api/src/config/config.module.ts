import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        APOLLO_API_KEY: Joi.string().required(),
        OPENAI_API_KEY: Joi.string().required(),
        ANTHROPIC_API_KEY: Joi.string().required(),
        PORT: Joi.number().default(3001),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        ORG_ID: Joi.string().uuid().required(),
        ORG_NAME: Joi.string().required(),
      }),
    }),
  ],
})
export class ConfigModule {}
