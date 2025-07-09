/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MagicLinkService {
  private transporter: any;
  private readonly logger = new Logger(MagicLinkService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Initialize the email transporter
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: Number.parseInt(this.configService.get('SMTP_PORT', '587')),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    });

    // Verify the transporter configuration
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('SMTP connection error:', error);
      } else {
        this.logger.log('SMTP server is ready to send messages');
      }
    });
  }

  // Generate a unique token for magic link
  async generateToken(email: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // Token expires in 1 hour

    // Store the token in the database
    await this.prisma.magicLink.upsert({
      where: { email },
      update: {
        token,
        expires,
      },
      create: {
        email,
        token,
        expires,
      },
    });

    return token;
  }

  // Verify a magic link token
  async verifyToken(
    token: string,
  ): Promise<{ email: string; isValid: boolean }> {
    const magicLink = await this.prisma.magicLink.findUnique({
      where: { token },
    });

    if (!magicLink) {
      return { email: null, isValid: false };
    }

    const now = new Date();
    const isValid = magicLink.expires > now;

    if (isValid) {
      // Delete the token after use
      await this.prisma.magicLink.delete({
        where: { token },
      });
    }

    return { email: magicLink.email, isValid };
  }

  // Send an email with the magic link
  async sendMagicLinkEmail(email: string, token: string): Promise<void> {
    const backendUrl = this.configService.get(
      'BACKEND_URL',
      'http://localhost:8000',
    );
    const magicLink = `${backendUrl}/auth/verify-magic-link?token=${token}`;

    // For development, we'll still log the link
    this.logger.log(`Magic link for ${email}: ${magicLink}`);

    try {
      const info = await this.transporter.sendMail({
        from: `"Lura App" <${this.configService.get('MAIL_FROM')}>`,
        to: email,
        subject: 'Your Magic Link to Sign In',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h1 style="color: #333; text-align: center;">Welcome to Lura!</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #555;">Click the button below to sign in:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Sign In to Lura</a>
            </div>
            <p style="font-size: 14px; color: #777;">This link will expire in 1 hour.</p>
            <p style="font-size: 14px; color: #777;">If you didn't request this email, you can safely ignore it.</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">© 2023 Lura. All rights reserved.</p>
          </div>
        `,
      });

      this.logger.log('Email sent successfully:', info.messageId);
    } catch (error) {
      this.logger.error('Failed to send magic link email:', error);
      // We'll still continue even if email fails, since we have the console log as backup
    }
  }
}
