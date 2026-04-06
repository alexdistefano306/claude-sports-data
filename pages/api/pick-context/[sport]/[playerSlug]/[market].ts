import type { NextApiRequest, NextApiResponse } from 'next';
import { getPickContext, type PickContextResponse } from '../../../../../lib/nba-service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PickContextResponse | { error: string }>
) {
  const { sport, playerSlug, market } = req.query;

  if (typeof sport !== 'string' || typeof playerSlug !== 'string' || typeof market !== 'string') {
    res.status(400).json({ error: 'Invalid route parameters.' });
    return;
  }

  try {
    const line = typeof req.query.line === 'string' ? req.query.line : undefined;
    const payload = await getPickContext({ sport, playerSlug, market, line });
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Unable to load pick context from the NBA service.'
    });
  }
}
