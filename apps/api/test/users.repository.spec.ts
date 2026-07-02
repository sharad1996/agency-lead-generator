import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { UsersRepository } from '../src/modules/users/users.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  user: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockUser = {
  id: 'user-1',
  tenantId: 'org-1',
  email: 'alice@example.com',
  name: 'Alice Chen',
  googleId: '123456',
  role: UserRole.MEMBER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersRepository', () => {
  let repo: UsersRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(UsersRepository);
    jest.clearAllMocks();
  });

  describe('upsert', () => {
    it('creates a new user when none exists', async () => {
      mockPrisma.user.upsert.mockResolvedValue(mockUser);

      const result = await repo.upsert({
        tenantId: 'org-1',
        email: 'alice@example.com',
        name: 'Alice Chen',
        googleId: '123456',
        role: UserRole.MEMBER,
      });

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'alice@example.com' },
          create: expect.objectContaining({ email: 'alice@example.com', role: UserRole.MEMBER }),
          update: { name: 'Alice Chen' },
        }),
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('returns all users for tenant ordered by createdAt', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      const result = await repo.findAll('org-1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'org-1' } }),
      );
    });
  });

  describe('updateRole', () => {
    it('updates user role by id', async () => {
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, role: UserRole.ADMIN });
      const result = await repo.updateRole('user-1', UserRole.ADMIN);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.ADMIN },
      });
      expect(result.role).toBe(UserRole.ADMIN);
    });
  });
});
