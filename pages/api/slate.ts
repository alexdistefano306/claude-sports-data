import type { NextApiRequest, NextApiResponse } from 'next';
import { getSlate } from '../../lib/data';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Optionally filter by date in a real implementation
  const slate = getSlate();
  res.status(200).json(slate);
}