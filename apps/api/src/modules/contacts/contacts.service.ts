import { Injectable } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import { UpsertContactDto } from './dto/upsert-contact.dto';
import { Contact } from '@prisma/client';

@Injectable()
export class ContactsService {
  constructor(private readonly repo: ContactsRepository) {}

  upsert(dto: UpsertContactDto): Promise<Contact> {
    return this.repo.upsertByApolloId(dto);
  }
}
