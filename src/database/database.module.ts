import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { DatabaseService } from './database.service';
import { SchemaRepository } from './schema.repository';
import { ResumeRepository } from './resume.repository';
@Global()
@Module({
  imports: [AppConfigModule],
  providers: [DatabaseService, SchemaRepository, ResumeRepository],
  exports: [DatabaseService, SchemaRepository, ResumeRepository],
})
export class DatabaseModule {}
