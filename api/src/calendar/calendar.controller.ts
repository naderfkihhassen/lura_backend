import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  async getEvents(@Req() req: any) {
    try {
      return await this.calendarService.getEvents(req.user.id);
    } catch (error) {
      throw new BadRequestException('Failed to get events');
    }
  }

  @Post()
  async createEvent(@Req() req: any, @Body() eventData: CreateEventDto) {
    try {
      const event = {
        ...eventData,
        start: new Date(eventData.start),
        end: eventData.end ? new Date(eventData.end) : undefined
      };
      return await this.calendarService.createEvent(req.user.id, event);
    } catch (error) {
      throw new BadRequestException('Failed to create event');
    }
  }

  @Put(':id')
  async updateEvent(@Req() req: any, @Param('id') id: string, @Body() eventData: UpdateEventDto) {
    try {
      const event = {
        ...eventData,
        start: eventData.start ? new Date(eventData.start) : undefined,
        end: eventData.end ? new Date(eventData.end) : undefined
      };
      return await this.calendarService.updateEvent(Number(id), req.user.id, event);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update event');
    }
  }

  @Delete(':id')
  async deleteEvent(@Req() req: any, @Param('id') id: string) {
    try {
      await this.calendarService.deleteEvent(Number(id), req.user.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete event');
    }
  }
} 