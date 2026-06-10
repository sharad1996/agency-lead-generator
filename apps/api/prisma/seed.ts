import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const orgId = process.env.ORG_ID ?? '00000000-0000-0000-0000-000000000001';

  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: {
      id: orgId,
      name: process.env.ORG_NAME ?? 'My Company',
    },
  });

  console.log(`Seeded organization: ${orgId}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
