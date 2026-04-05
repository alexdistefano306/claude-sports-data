import type { NextApiRequest, NextApiResponse } from 'next';
import {
  listPredictions,
  addPrediction,
} from '../../lib/predictions';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    // Return all recorded predictions
    res.status(200).json(listPredictions());
    return;
  }
  if (req.method === 'POST') {
    const { playerSlug, market, line, confidence } = req.body || {};
    if (!playerSlug || !market || typeof line !== 'number') {
      res.status(400).json({
        error: 'playerSlug, market and line are required fields',
      });
      return;
    }
    const pred = addPrediction({ playerSlug, market, line, confidence });
    res.status(201).json(pred);
    return;
  }
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
}