import { PrismaClient } from '@prisma/client';

// A single shared client avoids exhausting Postgres connections across
// hot-reloads in development and across the many controllers in production.
const prisma = new PrismaClient();

export default prisma;
