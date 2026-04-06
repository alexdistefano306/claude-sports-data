import type { NextApiRequest, NextApiResponse } from 'next';

type InjuryRow = {
  playerName: string;
  team: string;
  status: string;
  injuryType: string;
  updatedAt: string;
};

type InjuriesResponse = {
  injuries: InjuryRow[];
  source: string;
  errors: string[];
  notes: string[];
  updatedAt: string;
};

type EspnInjuryAthlete = {
  displayName?: string;
};

type EspnInjuryStatus = {
  name?: string;
};

type EspnInjuryDetail = {
  type?: string;
  status?: EspnInjuryStatus;
  date?: string;
};

type EspnTeamInjury = {
  team?: {
    abbreviation?: string;
  };
  athlete?: EspnInjuryAthlete;
  injuries?: EspnInjuryDetail[];
};

type EspnInjuryPayload = {
  injuries?: EspnTeamInjury[];
};

function normalizeStatus(raw?: string): string {
  const value = (raw ?? '').toUpperCase();
  if (value.includes('OUT')) return 'OUT';
  if (value.includes('QUESTION')) return 'QUESTIONABLE';
  if (value.includes('DOUBT')) return 'DOUBTFUL';
  if (value.includes('PROB')) return 'PROBABLE';
  if (value.includes('GAME')) return 'GTD';
  return raw ?? 'UNKNOWN';
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse<InjuriesResponse | { error: string }>) {
  try {
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries', {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`ESPN injuries request failed (${response.status}).`);
    }

    const payload = (await response.json()) as EspnInjuryPayload;
    const rows: InjuryRow[] = [];

    for (const teamInjury of payload.injuries ?? []) {
      const injuryDetails = teamInjury.injuries ?? [];
      for (const detail of injuryDetails) {
        rows.push({
          playerName: teamInjury.athlete?.displayName ?? 'Unknown player',
          team: teamInjury.team?.abbreviation ?? 'UNK',
          status: normalizeStatus(detail.status?.name),
          injuryType: detail.type ?? 'Unspecified',
          updatedAt: detail.date ?? 'Unknown'
        });
      }
    }

    res.status(200).json({
      injuries: rows,
      source: 'ESPN injury API (unofficial public JSON)',
      errors: [],
      notes: rows.length ? [] : ['ESPN returned an empty injuries list.'],
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Unable to load NBA injuries.'
    });
  }
}
