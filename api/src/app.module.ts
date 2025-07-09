import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { CaseModule } from './case/case.module';
import { DocumentModule } from './document/document.module';
import { CalendarModule } from './calendar/calendar.module';
import { ActivityModule } from './activity/activity.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // We'll remove the ServeStaticModule since we're now handling file serving directly
    // in the controller using StreamableFile
    PrismaModule,
    UserModule,
    AuthModule,
    WorkspaceModule,
    CaseModule,
    DocumentModule,
    CalendarModule,
    ActivityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
