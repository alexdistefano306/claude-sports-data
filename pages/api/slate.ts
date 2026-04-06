import type { NextApiRequest, NextApiResponse } from 'next';
import { getLiveSlate } from '../../lib/nba';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const games = await getLiveSlate(date);
  res.status(200).json({
    sport: 'NBA',
    date: date ?? new Date().toISOString().slice(0, 10),
    games,
    updatedAt: new Date().toISOString()
  });
}
