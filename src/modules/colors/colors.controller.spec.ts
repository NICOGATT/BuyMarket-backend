import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entity/user.entity';
import { ColorsController } from './colors.controller';

describe('ColorsController security', () => {
  const protectedHandlers = [
    ColorsController.prototype.create,
    ColorsController.prototype.update,
    ColorsController.prototype.remove,
  ];

  it.each(protectedHandlers)(
    'protege las mutaciones con JWT y rol ADMIN',
    (handler) => {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
        JwtAuthGuard,
        RolesGuard,
      ]);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.ADMIN]);
    },
  );

  it('mantiene publicos el listado, detalle y recomendacion', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ColorsController.prototype.findAll),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ColorsController.prototype.findOne),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        ColorsController.prototype.recommend,
      ),
    ).toBeUndefined();
  });
});
