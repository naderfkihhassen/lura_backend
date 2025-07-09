/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { TagController } from './tag.controller';
import { DocumentService } from './document.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, callback) => {
          // Create uploads directory if it doesn't exist
          const uploadsDir = join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log(`Created uploads directory at: ${uploadsDir}`);
          }
          callback(null, uploadsDir);
        },
        filename: (req, file, callback) => {
          // Generate a unique filename
          const uniqueSuffix = uuidv4();
          const ext = extname(file.originalname);
          const filename = `${uniqueSuffix}${ext}`;
          console.log(`Generated filename: ${filename}`);
          callback(null, filename);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Allow only specific file types
        const allowedMimeTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/gif',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          console.log(`File type ${file.mimetype} is allowed`);
          callback(null, true);
        } else {
          console.log(`File type ${file.mimetype} is not allowed`);
          callback(new Error(`Unsupported file type: ${file.mimetype}`), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
    }),
  ],
  controllers: [DocumentController, TagController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
