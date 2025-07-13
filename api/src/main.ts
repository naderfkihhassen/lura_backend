import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.log(`Created uploads directory at: ${uploadsDir}`);
  } else {
    logger.log(`Uploads directory exists at: ${uploadsDir}`);
  }

  // Check permissions
  try {
    const testFile = path.join(uploadsDir, 'test-write-permission.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    logger.log('Upload directory has write permissions');
  } catch (error) {
    logger.error(`Upload directory permission error: ${error.message}`);
  }

  // Initialize Prisma
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    logger.log('Connected to database successfully');
    await prisma.$disconnect();
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'], // Enable all log levels for debugging
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0'); // Listen on all interfaces
  console.log(`Application is running on port ${port}`);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
