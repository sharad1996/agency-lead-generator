import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '@prisma/client';
import { UsersRepository } from './users.repository';

export interface UpsertOnSignInInput {
  email: string;
  name?: string | null;
  googleId: string;
}

@Injectable()
export class UsersService {
  private readonly adminEmail: string;
  private readonly orgId: string;

  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly config: ConfigService,
  ) {
    this.adminEmail = this.config.get<string>('ADMIN_EMAIL')!;
    this.orgId = this.config.get<string>('ORG_ID')!;
  }

  async upsertOnSignIn(input: UpsertOnSignInInput): Promise<User> {
    const role = input.email === this.adminEmail ? UserRole.ADMIN : UserRole.MEMBER;
    return this.usersRepo.upsert({
      tenantId: this.orgId,
      email: input.email,
      name: input.name,
      googleId: input.googleId,
      role,
    });
  }

  async listUsers(tenantId: string): Promise<User[]> {
    return this.usersRepo.findAll(tenantId);
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    return this.usersRepo.updateRole(id, role);
  }
}
