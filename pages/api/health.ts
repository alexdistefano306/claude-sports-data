import type { NextApiRequest, NextApiResponse } from 'next';
import { getUpstreamHealth, type HealthResponse } from '../../lib/nba-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse<HealthResponse>) {
  const nbaServiceConfigured = Boolean(process.env.NBA_SERVICE_URL);
  const basePayload: HealthResponse = {
    status: nbaServiceConfigured ? 'ok' : 'degraded',
    service: 'prop-edge-web',
    nbaServiceConfigured,
    nbaServiceUrl: process.env.NBA_SERVICE_URL ?? null,
    timestamp: new Date().toISOString()
  };

  if (!nbaServiceConfigured) {
    res.status(200).json({
      ...basePayload,
      errors: ['NBA_SERVICE_URL is not configured.']
    });
    return;
  }

  try {
    const upstream = await getUpstreamHealth();
    res.status(200).json({
      ...basePayload,
      upstream
    });
  } catch (error) {
    res.status(502).json({
      ...basePayload,
      status: 'degraded',
      errors: [error instanceof Error ? error.message : 'Unable to reach the NBA service.']
    });
  }
}
