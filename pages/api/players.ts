import type { NextApiRequest, NextApiResponse } from 'next';
import { getLivePlayers, type PlayersResponse } from '../../lib/nba-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse<PlayersResponse | { error: string }>) {
  try {
    const rawLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 100;
    const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
    const search = typeof req.query.q === 'string' ? req.query.q : undefined;
    const payload = await getLivePlayers(limit, search);
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Unable to load players from the NBA service.'
    });
  }
}
