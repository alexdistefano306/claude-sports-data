import type { NextApiRequest, NextApiResponse } from 'next';
import { getLiveSlate, type SlateResponse } from '../../lib/nba-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse<SlateResponse | { error: string }>) {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const payload = await getLiveSlate(date);
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Unable to load the NBA slate.'
    });
  }
}
