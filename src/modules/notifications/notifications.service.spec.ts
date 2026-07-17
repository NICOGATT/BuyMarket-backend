import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: Record<string, jest.Mock>;
  let queryBuilder: Record<string, jest.Mock>;

  const userId = 'bdb0526e-0ee2-473d-8daa-a6e63c811f8f';
  const notificationId = '559b0806-5ec7-4669-b512-370136e57b8b';
  const createdAt = new Date('2026-07-16T12:00:00.000Z');

  const notification = {
    id: notificationId,
    user: { id: userId },
    type: NotificationType.NEW_SALE,
    title: 'Nueva venta',
    message: 'Vendiste un producto',
    data: { orderId: 'order-1' },
    eventKey: 'order:order-1:seller:user-1:sale',
    readAt: null,
    createdAt,
  } as Notification;

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    repository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('crea una notificacion con clave idempotente', async () => {
    repository.save.mockResolvedValue(notification);

    const result = await service.createOnce({
      userId,
      type: NotificationType.NEW_SALE,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      eventKey: notification.eventKey,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: userId },
        eventKey: notification.eventKey,
        readAt: null,
      }),
    );
    expect(result).toBe(notification);
  });

  it('recupera la existente cuando PostgreSQL informa una clave duplicada', async () => {
    repository.save.mockRejectedValue({ code: '23505' });
    repository.findOne.mockResolvedValue(notification);

    const result = await service.createOnce({
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      eventKey: notification.eventKey,
    });

    expect(result).toBe(notification);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { eventKey: notification.eventKey },
    });
  });

  it('pagina las notificaciones y devuelve el contador no leido', async () => {
    const second = {
      ...notification,
      id: '7a4db075-b46b-4c39-bb37-1e9a8a87e73d',
    } as Notification;
    queryBuilder.getMany.mockResolvedValue([notification, second]);
    repository.count.mockResolvedValue(4);

    const result = await service.findForUser(userId, { limit: 1 });

    expect(queryBuilder.take).toHaveBeenCalledWith(2);
    expect(result.items).toEqual([
      {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        readAt: null,
        createdAt,
      },
    ]);
    expect(result.nextCursor).toBe(notification.id);
    expect(result.unreadCount).toBe(4);
  });

  it('no acepta un cursor que no pertenece al usuario', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.findForUser(userId, { limit: 20, cursor: notificationId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no permite marcar una notificacion ajena', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.markAsRead(userId, notificationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('marca una notificacion propia y todas las pendientes', async () => {
    repository.findOne.mockResolvedValue({ ...notification });
    repository.save.mockImplementation(async (value) => value);
    queryBuilder.execute.mockResolvedValue({ affected: 3 });

    const read = await service.markAsRead(userId, notificationId);
    const all = await service.markAllAsRead(userId);

    expect(read.readAt).toBeInstanceOf(Date);
    expect(all).toEqual({ updated: 3 });
    expect(queryBuilder.where).toHaveBeenCalledWith('userId = :userId', {
      userId,
    });
  });
});
