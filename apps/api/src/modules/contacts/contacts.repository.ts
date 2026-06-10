import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Contact } from '@prisma/client';

export interface UpsertContactDto {
  tenantId: string;
  companyId: string;
  apolloId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  linkedinUrl?: string;
  title?: string;
}

@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByApolloId(dto: UpsertContactDto): Promise<Contact> {
    if (dto.apolloId) {
      return this.prisma.contact.upsert({
        where: { apolloId: dto.apolloId },
        update: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          linkedinUrl: dto.linkedinUrl,
          title: dto.title,
        },
        create: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          apolloId: dto.apolloId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          linkedinUrl: dto.linkedinUrl,
          title: dto.title,
        },
      });
    }

    // For CSV imports (no apolloId): upsert by [tenantId, email] if email present
    if (dto.email) {
      return this.prisma.contact.upsert({
        where: { tenantId_email: { tenantId: dto.tenantId, email: dto.email } },
        update: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          linkedinUrl: dto.linkedinUrl,
          title: dto.title,
          companyId: dto.companyId,
        },
        create: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          linkedinUrl: dto.linkedinUrl,
          title: dto.title,
        },
      });
    }

    return this.prisma.contact.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        linkedinUrl: dto.linkedinUrl,
        title: dto.title,
      },
    });
  }
}
