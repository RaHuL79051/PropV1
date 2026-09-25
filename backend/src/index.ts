import 'dotenv/config';
import app from './app.js';
import prisma from './lib/prisma.js';
import { seedDefaults, backfillTenantOwnerConnections } from './utils/seed-defaults.js';
import { startMonthlyBillingScheduler } from './utils/scheduler.js';

const PORT = process.env.PORT || 5000;

// On Vercel the serverless entry point (api/index.ts) is what boots the app,
// not this file — `.listen()` and `setInterval` don't survive between
// invocations there. Only run the long-lived server on local dev, Render, or
// any host where a Node process keeps running.
if (!process.env.VERCEL) {
  prisma
    .$connect()
    .then(async () => {
      console.log('Successfully connected to the Postgres database');
      await seedDefaults();
      await backfillTenantOwnerConnections();
      startMonthlyBillingScheduler();
      app.listen(PORT, () => {
        console.log(`Server is running in production-ready mode on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Database connection failed', err);
      process.exit(1);
    });
}
