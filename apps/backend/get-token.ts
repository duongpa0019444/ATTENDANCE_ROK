import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (!user) {
    console.error('Admin user not found');
    return;
  }

  const isMatch = await bcrypt.compare('admin', user.password);
  if (!isMatch) {
    console.error('Password mismatch');
    return;
  }

  const payload = { username: user.username, sub: user.id, role: user.role };
  // CYBER_SECRET is the default jwt secret in auth.module.ts
  const token = jwt.sign(payload, 'CYBER_SECRET');
  console.log('JWT_TOKEN=' + token);
}

main().finally(() => prisma.$disconnect());
