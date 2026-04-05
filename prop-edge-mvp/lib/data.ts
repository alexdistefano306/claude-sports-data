export interface Player {
  slug: string;
  name: string;
  team: string;
  position: string;
  seasonAvg: number;
  careerAvg: number;
  last10Avg: number;
  homeSplit: number;
  awaySplit: number;
  minutesLast5: number[];
}

export interface Game {
  id: number;
  sport: string;
  teams: [string, string];
  startTime: string;
}

// Sample player data. In a production system, this would come from a database.
const players: Player[] = [
  {
    slug: 'jalen-brunson',
    name: 'Jalen Brunson',
    team: 'NYK',
    position: 'PG',
    seasonAvg: 26.1,
    careerAvg: 18.7,
    last10Avg: 28.3,
    homeSplit: 27.8,
    awaySplit: 24.4,
    minutesLast5: [37, 39, 36, 38, 35],
  },
  {
    slug: 'jimmy-butler',
    name: 'Jimmy Butler',
    team: 'MIA',
    position: 'SF',
    seasonAvg: 21.5,
    careerAvg: 21.5,
    last10Avg: 22.0,
    homeSplit: 22.1,
    awaySplit: 20.8,
    minutesLast5: [32, 34, 31, 33, 35],
  },
];

// Sample game slate. Real data should be pulled from an odds or schedule feed.
const games: Game[] = [
  {
    id: 1,
    sport: 'NBA',
    teams: ['NYK', 'MIA'],
    startTime: '2026-04-05T19:00:00Z',
  },
  {
    id: 2,
    sport: 'NBA',
    teams: ['LAL', 'BOS'],
    startTime: '2026-04-05T21:00:00Z',
  },
];

export function getSlate(): Game[] {
  return games;
}

export function getPlayers(): Player[] {
  return players;
}

export function getPlayerBySlug(slug: string): Player | undefined {
  return players.find((p) => p.slug === slug);
}

export function getSamplePickContext(
  sport: string,
  slug: string,
  market: string,
) {
  const player = getPlayerBySlug(slug);
  if (!player) {
    return null;
  }
  // Create a simple line based off the player's season average.
  const line = parseFloat((player.seasonAvg + 1.5).toFixed(1));
  return {
    player: player.name,
    sport: sport.toUpperCase(),
    market: market.toUpperCase(),
    line,
    team: player.team,
    opponent: 'MIA', // Static for example purposes.
    season_avg: player.seasonAvg,
    career_avg: player.careerAvg,
    last_10_avg: player.last10Avg,
    home_split: player.homeSplit,
    away_split: player.awaySplit,
    minutes_last_5: player.minutesLast5,
    injury_context: {
      teammates_out: [] as string[],
      status: 'Active',
    },
    game_context: {
      spread: 0,
      total: 220,
      rest_days: 1,
    },
    source_timestamps: {
      odds_updated_at: new Date().toISOString(),
      stats_updated_at: new Date().toISOString(),
    },
  };
}