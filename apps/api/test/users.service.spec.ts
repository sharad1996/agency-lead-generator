import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { UsersService } from '../src/modules/users/users.service';
import { UsersRepository } from '../src/modules/users/users.repository';

const mockRepo = {
  upsert: jest.fn(),
  findAll: jest.fn(),
  updateRole: jest.fn(),
};

const configMock = {
  get: (k: string) => {
    if (k === 'ADMIN_EMAIL') return 'admin@example.com';
    if (k === 'ORG_ID') return 'org-1';
    return undefined;
  },
};

const baseUser = {
  id: 'user-1',
  tenantId: 'org-1',
  email: 'user@example.com',
  name: 'Test User',
  googleId: 'gid-1',
  role: UserRole.MEMBER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockRepo },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('upsertOnSignIn', () => {
    it('creates ADMIN when email matches ADMIN_EMAIL', async () => {
      mockRepo.upsert.mockResolvedValue({ ...baseUser, email: 'admin@example.com', role: UserRole.ADMIN });

      const result = await service.upsertOnSignIn({
        email: 'admin@example.com',
        name: 'Admin User',
        googleId: 'gid-admin',
      });

      expect(mockRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN }),
      );
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('creates MEMBER for unknown email', async () => {
      mockRepo.upsert.mockResolvedValue(baseUser);

      const result = await service.upsertOnSignIn({
        email: 'user@example.com',
        name: 'Regular User',
        googleId: 'gid-1',
      });

      expect(mockRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.MEMBER }),
      );
      expect(result.role).toBe(UserRole.MEMBER);
    });

    it('returns existing user without changing role on subsequent sign-ins', async () => {
      mockRepo.upsert.mockResolvedValue({ ...baseUser, role: UserRole.ADMIN });

      const result = await service.upsertOnSignIn({
        email: 'user@example.com',
        name: 'Promoted User',
        googleId: 'gid-1',
      });

      expect(result.role).toBe(UserRole.ADMIN);
    });
  });

  describe('listUsers', () => {
    it('delegates to repository', async () => {
      mockRepo.findAll.mockResolvedValue([baseUser]);
      const result = await service.listUsers('org-1');
      expect(result).toHaveLength(1);
      expect(mockRepo.findAll).toHaveBeenCalledWith('org-1');
    });
  });

  describe('updateRole', () => {
    it('delegates to repository', async () => {
      mockRepo.updateRole.mockResolvedValue({ ...baseUser, role: UserRole.ADMIN });
      const result = await service.updateRole('user-1', UserRole.ADMIN);
      expect(result.role).toBe(UserRole.ADMIN);
      expect(mockRepo.updateRole).toHaveBeenCalledWith('user-1', UserRole.ADMIN);
    });
  });
});
