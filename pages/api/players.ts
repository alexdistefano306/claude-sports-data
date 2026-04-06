import type { NextApiRequest, NextApiResponse } from 'next';
import { getLivePlayers } from '../../lib/nba';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 100;
  const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
  const players = await getLivePlayers(limit);
  res.status(200).json({
    players,
    updatedAt: new Date().toISOString()
  });
}
