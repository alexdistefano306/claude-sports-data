import type { NextApiRequest, NextApiResponse } from 'next';
import { getSamplePickContext } from '../../../../../lib/data';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { sport, playerSlug, market } = req.query;

  if (
    typeof sport !== 'string' ||
    typeof playerSlug !== 'string' ||
    typeof market !== 'string'
  ) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  const context = getSamplePickContext(
    sport,
    decodeURIComponent(playerSlug),
    market,
  );

  if (!context) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }

  res.status(200).json(context);
}
