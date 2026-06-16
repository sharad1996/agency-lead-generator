import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertUserDto {
  tenantId: string;
  email: string;
  name?: string | null;
  googleId: string;
  role: UserRole;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: UpsertUserDto): Promise<User> {
    return this.prisma.user.upsert({
      where: { email: dto.email },
      create: {
        tenantId: dto.tenantId,
        email: dto.email,
        name: dto.name,
        googleId: dto.googleId,
        role: dto.role,
      },
      update: { name: dto.name ?? undefined },
    });
  }

  async findAll(tenantId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }
}
