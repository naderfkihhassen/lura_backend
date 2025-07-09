import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module'; // Import AuthModule with forwardRef

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule), // Use forwardRef to handle circular dependency
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Make sure UserService is exported
})
export class UserModule {}
