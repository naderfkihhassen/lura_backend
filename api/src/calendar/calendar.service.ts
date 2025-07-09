import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Cron } from '@nestjs/schedule';

export interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end?: Date;
  status: string;
  notes?: string;
  userId: number;
  reminders?: Reminder;
  createdAt: Date;
  updatedAt: Date;
}

interface Reminder {
  enabled: boolean;
  times: number[];
  soundEnabled: boolean;
  emailEnabled: boolean;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private transporter: any;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Initialize the email transporter
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: Number.parseInt(this.configService.get('SMTP_PORT', '587')),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    });

    // Verify the transporter configuration
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('SMTP connection error:', error);
      } else {
        this.logger.log('SMTP server is ready to send messages');
      }
    });
  }

  async getEvents(userId: number): Promise<CalendarEvent[]> {
    try {
      const events = await this.prisma.calendarEvent.findMany({
        where: { userId },
        orderBy: { start: 'asc' }
      });

      return events.map(event => ({
        ...event,
        start: new Date(event.start),
        end: event.end ? new Date(event.end) : undefined,
        reminders: event.reminders ? JSON.parse(event.reminders as string) : null
      }));
    } catch (error) {
      this.logger.error(`Failed to get events for user ${userId}:`, error);
      throw error;
    }
  }

  async createEvent(userId: number, eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const { title, start, end, notes, status, reminders } = eventData;
    
    if (!title || !start) {
      throw new BadRequestException('Title and start time are required');
    }

    try {
      const event = await this.prisma.calendarEvent.create({
        data: {
          title,
          start: new Date(start),
          end: end ? new Date(end) : null,
          notes: notes || null,
          status: status || 'scheduled',
          reminders: reminders ? JSON.stringify(reminders) : null,
          userId
        }
      });

      // Add to activity log
      await this.prisma.activity.create({
        data: {
          type: 'CALENDAR_EVENT_CREATED',
          description: `Created calendar event: ${title}`,
          userId,
          metadata: JSON.stringify({ eventId: event.id })
        }
      });

      return {
        ...event,
        start: new Date(event.start),
        end: event.end ? new Date(event.end) : undefined,
        reminders: event.reminders ? JSON.parse(event.reminders as string) : null
      };
    } catch (error) {
      this.logger.error(`Failed to create event for user ${userId}:`, error);
      throw error;
    }
  }

  async updateEvent(id: number, userId: number, eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const { title, start, end, notes, status, reminders } = eventData;
    
    try {
      const event = await this.prisma.calendarEvent.update({
        where: { id },
        data: {
          title,
          start: start ? new Date(start) : undefined,
          end: end ? new Date(end) : undefined,
          notes,
          status,
          reminders: reminders ? JSON.stringify(reminders) : undefined
        }
      });

      // Add to activity log
      await this.prisma.activity.create({
        data: {
          type: 'CALENDAR_EVENT_UPDATED',
          description: `Updated calendar event: ${event.title}`,
          userId,
          metadata: JSON.stringify({ eventId: event.id })
        }
      });

      return {
        ...event,
        start: new Date(event.start),
        end: event.end ? new Date(event.end) : undefined,
        reminders: event.reminders ? JSON.parse(event.reminders as string) : null
      };
    } catch (error) {
      this.logger.error(`Failed to update event ${id} for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteEvent(id: number, userId: number): Promise<void> {
    try {
      const event = await this.prisma.calendarEvent.findUnique({
        where: { id }
      });

      if (!event) {
        throw new NotFoundException('Event not found');
      }

      await this.prisma.calendarEvent.delete({
        where: { id }
      });

      // Add to activity log
      await this.prisma.activity.create({
        data: {
          type: 'CALENDAR_EVENT_DELETED',
          description: `Deleted calendar event: ${event.title}`,
          userId,
          metadata: JSON.stringify({ eventId: id })
        }
      });
    } catch (error) {
      this.logger.error(`Failed to delete event ${id} for user ${userId}:`, error);
      throw error;
    }
  }

  @Cron('*/5 * * * *') // Run every 5 minutes
  async checkReminders() {
    try {
      const now = new Date();
      const windowMinutes = 5; // cron runs every 5 minutes
      const events = await this.prisma.calendarEvent.findMany({
        where: {
          reminders: {
            not: null
          }
        },
        include: {
          user: true
        }
      });

      for (const event of events) {
        const reminders = event.reminders ? JSON.parse(event.reminders as string) as Reminder : null;
        if (!reminders || !reminders.enabled) continue;

        const eventStart = new Date(event.start);
        const timeUntilEvent = eventStart.getTime() - now.getTime();
        const minutesUntilEvent = Math.floor(timeUntilEvent / (1000 * 60));

        // 1. Send reminders before event
        for (const reminderTime of reminders.times) {
          // Trigger if within the window
          if (
            minutesUntilEvent <= reminderTime &&
            minutesUntilEvent > reminderTime - windowMinutes
          ) {
            let emailStatus = 'not sent';
            let emailError = null;
            // Send email reminder if enabled
            if (reminders.emailEnabled && event.user.email) {
              try {
                await this.sendReminderEmail(event, reminderTime);
                emailStatus = 'sent';
              } catch (err) {
                emailStatus = 'failed';
                emailError = err instanceof Error ? err.message : String(err);
                this.logger.error(`Failed to send reminder email for event ${event.id}:`, err);
              }
            }

            // Add to activity log (always)
            await this.prisma.activity.create({
              data: {
                type: 'CALENDAR_REMINDER',
                description: `Reminder: ${event.title} in ${this.formatReminderTime(reminderTime)} (email: ${emailStatus}${emailError ? ', error: ' + emailError : ''})`,
                userId: event.userId,
                metadata: JSON.stringify({ eventId: event.id, reminderTime, emailStatus, emailError })
              }
            });
          }
        }

        // 2. Send expired notification if event is past and still scheduled
        if (event.status === 'scheduled' && eventStart < now) {
          // Check if expiry email already sent
          const alreadyExpired = await this.prisma.activity.findFirst({
            where: {
              type: 'CALENDAR_EVENT_EXPIRED',
              userId: event.userId,
              metadata: { contains: `"eventId":${event.id}` }
            }
          });
          if (!alreadyExpired) {
            let emailStatus = 'not sent';
            let emailError = null;
            if (reminders.emailEnabled && event.user.email) {
              try {
                await this.sendExpiredEventEmail(event);
                emailStatus = 'sent';
              } catch (err) {
                emailStatus = 'failed';
                emailError = err instanceof Error ? err.message : String(err);
                this.logger.error(`Failed to send expired event email for event ${event.id}:`, err);
              }
            }
            await this.prisma.activity.create({
              data: {
                type: 'CALENDAR_EVENT_EXPIRED',
                description: `Event expired: ${event.title} (email: ${emailStatus}${emailError ? ', error: ' + emailError : ''})`,
                userId: event.userId,
                metadata: JSON.stringify({ eventId: event.id, emailStatus, emailError })
              }
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to check reminders:', error);
    }
  }

  private async sendReminderEmail(event: any, reminderTime: number) {
    try {
      const timeString = this.formatReminderTime(reminderTime);
      await this.transporter.sendMail({
        from: `"Lura Calendar" <${this.configService.get('MAIL_FROM')}>`,
        to: event.user.email,
        subject: `Reminder: ${event.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h1 style="color: #333; text-align: center;">Calendar Reminder</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #555;">
              This is a reminder that you have an event coming up:
            </p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h2 style="color: #000; margin-top: 0;">${event.title}</h2>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date(event.start).toLocaleString()}</p>
              ${event.notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${event.notes}</p>` : ''}
              <p style="margin: 5px 0;"><strong>Reminder:</strong> ${timeString} before event</p>
            </div>
            <p style="font-size: 14px; color: #777;">This reminder was sent automatically by Lura Calendar.</p>
          </div>
        `
      });
      this.logger.log(`Reminder email sent for event ${event.id} to ${event.user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send reminder email for event ${event.id}:`, error);
    }
  }

  private async sendExpiredEventEmail(event: any) {
    try {
      await this.transporter.sendMail({
        from: `"Lura Calendar" <${this.configService.get('MAIL_FROM')}>`,
        to: event.user.email,
        subject: `Event Expired: ${event.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h1 style="color: #c00; text-align: center;">Event Expired</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #555;">
              The following event has expired:
            </p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h2 style="color: #000; margin-top: 0;">${event.title}</h2>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date(event.start).toLocaleString()}</p>
              ${event.notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${event.notes}</p>` : ''}
            </div>
            <p style="font-size: 14px; color: #777;">This notification was sent automatically by Lura Calendar.</p>
          </div>
        `
      });
      this.logger.log(`Expired event email sent for event ${event.id} to ${event.user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send expired event email for event ${event.id}:`, error);
      throw error;
    }
  }

  private formatReminderTime(minutes: number): string {
    if (minutes >= 1440) { // 24 hours
      const days = Math.floor(minutes / 1440);
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }
}
