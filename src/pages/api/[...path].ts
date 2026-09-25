import type { NextApiRequest, NextApiResponse } from 'next';
import 'dotenv/config';
import app from '@/server/app';
import { seedDefaults } from '@/server/utils/seed-defaults';

// The Express app has its own body parser (express.json / urlencoded). If we
// let Next.js parse the body first, Express's parser hangs on the already-drained
// stream. externalResolver silences the "unresolved handler" warning Next.js
// otherwise logs when it can't tell we ended the response ourselves.
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true
  }
};

// Cache the seed check per warmed serverless instance. seedDefaults() is
// idempotent (findFirst before create), so a second cold-start rerunning it is
// harmless — this cache just avoids the extra queries per request.
let seedPromise: Promise<void> | null = null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!seedPromise) {
    seedPromise = seedDefaults().catch((err) => {
      console.error('[Seed] Failed on serverless startup:', err);
      // Reset so the next request retries instead of wedging the instance.
      seedPromise = null;
    });
  }
  await seedPromise;
  return (app as unknown as (req: NextApiRequest, res: NextApiResponse) => void)(req, res);
}
