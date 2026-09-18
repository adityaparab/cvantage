import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfig } from './app-config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ ignoreEnvFile: process.env.NODE_ENV === 'test' }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
