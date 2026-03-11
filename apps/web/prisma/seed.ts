import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const email = 'admin@visiblee.dev';
  const password = 'superadmin123';
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email },
    update: { role: 'superadmin' },
    create: {
      email,
      name: 'Superadmin',
      hashedPassword,
      role: 'superadmin',
      preferredLocale: 'en',
    },
  });

  console.log(`Seeded superadmin: ${user.email} (password: ${password})`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
