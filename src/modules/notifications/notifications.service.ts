import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';

import { ListNotificationsDto } from './dto/list-notifications.dto';
import { Notification, NotificationType } from './entities/notification.entity';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  eventKey: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  async createOnce(input: CreateNotificationInput) {
    const notification = this.notificationsRepository.create({
      user: { id: input.userId },
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data ?? {},
      eventKey: input.eventKey,
      readAt: null,
    });

    try {
      return await this.notificationsRepository.save(notification);
    } catch (error: unknown) {
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (errorCode !== '23505') throw error;

      return this.notificationsRepository.findOne({
        where: { eventKey: input.eventKey },
      });
    }
  }

  createManyOnce(inputs: CreateNotificationInput[]) {
    return Promise.all(inputs.map((input) => this.createOnce(input)));
  }

  async findForUser(userId: string, dto: ListNotificationsDto) {
    const limit = dto.limit ?? 20;
    const query = this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .addOrderBy('notification.id', 'DESC')
      .take(limit + 1);

    if (dto.cursor) {
      const cursor = await this.notificationsRepository.findOne({
        where: { id: dto.cursor, user: { id: userId } },
      });
      if (!cursor) {
        throw new NotFoundException('Cursor de notificaciones no encontrado');
      }

      query.andWhere(
        new Brackets((builder) => {
          builder
            .where('notification.createdAt < :cursorDate', {
              cursorDate: cursor.createdAt,
            })
            .orWhere(
              'notification.createdAt = :cursorDate AND notification.id < :cursorId',
              { cursorDate: cursor.createdAt, cursorId: cursor.id },
            );
        }),
      );
    }

    const [rows, unreadCount] = await Promise.all([
      query.getMany(),
      this.notificationsRepository.count({
        where: { user: { id: userId }, readAt: IsNull() },
      }),
    ]);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      items: items.map((item) => this.toPublic(item)),
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
      unreadCount,
    };
  }

  async getUnreadCount(userId: string) {
    return {
      unreadCount: await this.notificationsRepository.count({
        where: { user: { id: userId }, readAt: IsNull() },
      }),
    };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.notificationsRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!notification)
      throw new NotFoundException('Notificacion no encontrada');

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationsRepository.save(notification);
    }

    return this.toPublic(notification);
  }

  async markAllAsRead(userId: string) {
    const result = await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();

    return { updated: result.affected ?? 0 };
  }

  private toPublic(notification: Notification) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
