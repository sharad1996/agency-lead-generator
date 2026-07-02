import { ContactsRepository } from '../src/modules/contacts/contacts.repository';

describe('ContactsRepository', () => {
  let repo: ContactsRepository;
  let prisma: {
    contact: {
      create: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      contact: {
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };

    repo = new ContactsRepository(prisma as never);
  });

  it('creates a contact when neither apolloId nor email is available', async () => {
    prisma.contact.create.mockResolvedValue({ id: 'contact-1' });

    const result = await repo.upsertByApolloId({
      tenantId: 'tenant-1',
      companyId: 'company-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: undefined,
      linkedinUrl: undefined,
      title: undefined,
    });

    expect(result).toEqual({ id: 'contact-1' });
    expect(prisma.contact.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        companyId: 'company-1',
        firstName: 'Jane',
        lastName: 'Doe',
        linkedinUrl: undefined,
        title: undefined,
      },
    });
  });
});
