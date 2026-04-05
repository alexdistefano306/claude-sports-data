import type { NextApiRequest, NextApiResponse } from 'next';
import {
  addResult,
  listPredictions,
} from '../../lib/predictions';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'POST') {
    const { id, result } = req.body || {};
    if (typeof id !== 'number' || typeof result !== 'string') {
      res
        .status(400)
        .json({ error: 'id (number) and result (string) are required' });
      return;
    }
    const pred = addResult(id, result);
    if (!pred) {
      res.status(404).json({ error: 'Prediction not found' });
      return;
    }
    res.status(200).json(pred);
    return;
  }
  if (req.method === 'GET') {
    // Return only predictions with a result
    const results = listPredictions().filter((p) => Boolean(p.result));
    res.status(200).json(results);
    return;
  }
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
}