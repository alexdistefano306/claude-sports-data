import type { NextApiRequest, NextApiResponse } from 'next';
import { getLivePickContext } from '../../../../../lib/nba';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sport, playerSlug, market } = req.query;
  const parsedLine = typeof req.query.line === 'string' ? Number.parseFloat(req.query.line) : null;

  if (sport !== 'nba' || typeof playerSlug !== 'string' || typeof market !== 'string') {
    res.status(400).json({ error: 'Use /api/pick-context/nba/:playerSlug/:market' });
    return;
  }

  const context = await getLivePickContext(playerSlug, market, Number.isFinite(parsedLine) ? parsedLine : null);
  res.status(200).json(context);
}
