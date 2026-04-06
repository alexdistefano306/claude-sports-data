import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ballDontLieConfigured: Boolean(process.env.BALLDONTLIE_API_KEY)
  });
}
