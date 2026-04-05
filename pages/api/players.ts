import type { NextApiRequest, NextApiResponse } from 'next';
import { getPlayers } from '../../lib/data';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const players = getPlayers();
  res.status(200).json(players);
}