// Vercel Serverless entry point. This file is what Vercel invokes for every
// request against this backend project — the vercel.json rewrite forwards
// every path here, so Express handles routing on its own.
//
// Local dev, Render, and any other long-lived host use src/index.ts instead,
// which calls app.listen(). This module NEVER calls .listen() — Vercel wraps
// the exported handler itself.

import 'dotenv/config';
import app from '../src/app.js';
import { seedDefaults } from '../src/utils/seed-defaults.js';

// Runs at most once per warmed serverless instance. The seed itself is
// idempotent (findFirst before create), so running it more than once across
// cold starts is safe — this cache just avoids the extra queries per request.
let seedPromise: Promise<void> | null = null;

app.use(async (_req, _res, next) => {
  if (!seedPromise) {
    seedPromise = seedDefaults().catch((err) => {
      console.error('[Seed] Failed on serverless startup:', err);
      // Reset so the next request retries instead of wedging the instance.
      seedPromise = null;
    });
  }
  await seedPromise;
  next();
});

export default app;
