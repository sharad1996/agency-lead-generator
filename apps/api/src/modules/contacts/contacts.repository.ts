import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Contact } from '@prisma/client';
import { UpsertContactDto } from './dto/upsert-contact.dto';

@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByApolloId(dto: UpsertContactDto): Promise<Contact> {
    // Path 1: apolloId present — primary dedup key
    if (dto.apolloId) {
      try {
        return await this.prisma.contact.upsert({
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
      } catch (err: unknown) {
        // P2002 = unique constraint violation — contact exists by email (CSV import),
        // merge by stamping apolloId onto the existing row
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'P2002' &&
          dto.email
        ) {
          return this.prisma.contact.update({
            where: { tenantId_email: { tenantId: dto.tenantId, email: dto.email } },
            data: {
              apolloId: dto.apolloId,
              firstName: dto.firstName,
              lastName: dto.lastName,
              linkedinUrl: dto.linkedinUrl,
              title: dto.title,
            },
          });
        }
        throw err;
      }
    }

    // Path 2: no apolloId, but email present — upsert by composite unique key
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

    // Path 3: neither apolloId nor email — create a fallback contact record
    return this.prisma.contact.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        linkedinUrl: dto.linkedinUrl,
        title: dto.title,
      },
    });
  }

  async findByCompanyId(companyId: string, tenantId: string): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: { companyId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
