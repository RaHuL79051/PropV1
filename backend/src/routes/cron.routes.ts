import { Router, Request, Response } from 'express';
import { generateAndSendMonthlyBills } from '../utils/scheduler.js';

const router = Router();

// Vercel Cron (see vercel.json) hits this daily. Vercel signs each cron
// invocation with `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
// set — reject anything else so the endpoint can't be triggered by strangers.
router.get('/monthly-billing', async (req: Request, res: Response) => {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${expected}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    await generateAndSendMonthlyBills();
    return res.status(200).json({ ok: true, ranAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Cron] Monthly billing job failed:', err);
    return res.status(500).json({ error: 'Job failed' });
  }
});

export default router;
