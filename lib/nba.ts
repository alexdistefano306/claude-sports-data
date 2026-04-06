export interface DashboardGame {
  id: string;
  sport: 'NBA';
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  startTime: string;
  status: string;
  source: 'nba' | 'balldontlie' | 'fallback';
}

export interface DashboardPlayer {
  playerId: number | string;
  slug: string;
  name: string;
  team: string;
  position: string;
  source: 'nba' | 'balldontlie' | 'fallback';
}

export interface PickContextResponse {
  player: string;
  sport: 'NBA';
  market: string;
  line: number | null;
  team: string;
  opponent: string | null;
  position: string;
  season_avg: number | null;
  career_avg: number | null;
  last_10_avg: number | null;
  home_split: number | null;
  away_split: number | null;
  minutes_last_5: number[];
  injury_context: {
    teammates_out: string[];
    status: string;
  };
  game_context: {
    spread: number | null;
    total: number | null;
    rest_days: number | null;
  };
  source_timestamps: {
    odds_updated_at: string;
    stats_updated_at: string;
  };
  source: 'nba' | 'balldontlie' | 'fallback';
  notes?: string[];
}

type NbaResultSet = {
  name?: string;
  headers?: string[];
  rowSet?: unknown[];
};

type NbaPayload = {
  resultSets?: NbaResultSet[];
  resultSet?: NbaResultSet;
};

const NBA_BASE = 'https://stats.nba.com/stats';
const BDL_BASE = 'https://api.balldontlie.io/v1';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getSeasonString(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 10 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!filtered.length) return null;
  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(1));
}

function toObjects(resultSet?: NbaResultSet): Record<string, unknown>[] {
  if (!resultSet?.headers || !Array.isArray(resultSet.rowSet)) return [];
  return resultSet.rowSet.map((row) => {
    const values = Array.isArray(row) ? row : [];
    return resultSet.headers!.reduce<Record<string, unknown>>((acc, header, index) => {
      acc[header] = values[index];
      return acc;
    }, {});
  });
}

function buildResultSetMap(payload: NbaPayload): Record<string, Record<string, unknown>[]> {
  const sets = Array.isArray(payload.resultSets)
    ? payload.resultSets
    : payload.resultSet
      ? [payload.resultSet]
      : [];
  return sets.reduce<Record<string, Record<string, unknown>[]>>((acc, set) => {
    if (set.name) acc[set.name] = toObjects(set);
    return acc;
  }, {});
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
}

async function nbaFetch(endpoint: string, params: Record<string, string>): Promise<NbaPayload> {
  const url = new URL(`${NBA_BASE}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://www.nba.com',
      Referer: 'https://www.nba.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'x-nba-stats-origin': 'stats',
      'x-nba-stats-token': 'true'
    }
  });

  if (!response.ok) throw new Error(`NBA API error: ${response.status}`);
  return response.json() as Promise<NbaPayload>;
}

async function balldontlieFetch(path: string, params: Record<string, string | string[]> = {}) {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) throw new Error('BALLDONTLIE_API_KEY is not set');

  const url = new URL(`${BDL_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(`${key}[]`, item));
    } else if (value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      Authorization: apiKey,
      Accept: 'application/json'
    }
  });

  if (!response.ok) throw new Error(`BALLDONTLIE error: ${response.status}`);
  return response.json();
}

async function getNbaScoreboard(date: string): Promise<DashboardGame[]> {
  const payload = await nbaFetch('scoreboardv2', { DayOffset: '0', GameDate: date, LeagueID: '00' });
  const sets = buildResultSetMap(payload);
  const headers = sets.GameHeader ?? [];
  const lines = sets.LineScore ?? [];
  const teamMap = new Map<string, string>();

  lines.forEach((row) => {
    const gameId = String(row.GAME_ID ?? '');
    const teamId = String(row.TEAM_ID ?? '');
    const abbr = String(row.TEAM_ABBREVIATION ?? '');
    if (gameId && teamId && abbr) teamMap.set(`${gameId}:${teamId}`, abbr);
  });

  return headers.map((row) => {
    const gameId = String(row.GAME_ID ?? '');
    const homeTeamId = Number(row.HOME_TEAM_ID ?? 0);
    const awayTeamId = Number(row.VISITOR_TEAM_ID ?? 0);
    return {
      id: gameId,
      sport: 'NBA',
      homeTeam: teamMap.get(`${gameId}:${homeTeamId}`) ?? 'HOME',
      awayTeam: teamMap.get(`${gameId}:${awayTeamId}`) ?? 'AWAY',
      homeTeamId,
      awayTeamId,
      startTime: String(row.GAME_DATE_EST ?? date),
      status: String(row.GAME_STATUS_TEXT ?? 'Scheduled'),
      source: 'nba'
    };
  });
}

async function getBdlGames(date: string): Promise<DashboardGame[]> {
  const payload = await balldontlieFetch('/games', { dates: [date], per_page: '100' });
  const games = Array.isArray(payload?.data) ? payload.data : [];
  return games.map((game: any) => ({
    id: String(game.id),
    sport: 'NBA',
    homeTeam: game.home_team?.abbreviation ?? 'HOME',
    awayTeam: game.visitor_team?.abbreviation ?? 'AWAY',
    homeTeamId: game.home_team?.id,
    awayTeamId: game.visitor_team?.id,
    startTime: game.datetime ?? `${date}T00:00:00Z`,
    status: game.status ?? 'Scheduled',
    source: 'balldontlie'
  }));
}

export async function getLiveSlate(date = todayString()): Promise<DashboardGame[]> {
  try {
    return await getNbaScoreboard(date);
  } catch {
    try {
      return await getBdlGames(date);
    } catch {
      return [];
    }
  }
}

async function getNbaPlayers(limit = 100): Promise<DashboardPlayer[]> {
  const payload = await nbaFetch('commonallplayers', {
    IsOnlyCurrentSeason: '1',
    LeagueID: '00',
    Season: getSeasonString()
  });
  const rows = (buildResultSetMap(payload).CommonAllPlayers ?? []).filter((row) => Number(row.ROSTERSTATUS ?? 0) === 1 || row.ROSTERSTATUS === '1');
  return rows.slice(0, limit).map((row) => {
    const name = String(row.DISPLAY_FIRST_LAST ?? row.DISPLAY_LAST_COMMA_FIRST ?? 'Unknown Player');
    return {
      playerId: Number(row.PERSON_ID ?? 0),
      slug: String(row.PLAYER_SLUG ?? slugify(name)),
      name,
      team: String(row.TEAM_ABBREVIATION ?? ''),
      position: '',
      source: 'nba'
    };
  });
}

async function getBdlPlayers(limit = 100): Promise<DashboardPlayer[]> {
  const payload = await balldontlieFetch('/players/active', { per_page: String(Math.min(limit, 100)) });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.slice(0, limit).map((player: any) => ({
    playerId: player.id,
    slug: slugify(`${player.first_name} ${player.last_name}`),
    name: `${player.first_name} ${player.last_name}`,
    team: player.team?.abbreviation ?? '',
    position: player.position ?? '',
    source: 'balldontlie'
  }));
}

export async function getLivePlayers(limit = 100): Promise<DashboardPlayer[]> {
  try {
    return await getNbaPlayers(limit);
  } catch {
    try {
      return await getBdlPlayers(limit);
    } catch {
      return [];
    }
  }
}

async function findNbaPlayerBySlug(slug: string): Promise<DashboardPlayer | null> {
  const players = await getNbaPlayers(600);
  const normalized = slug.toLowerCase();
  return players.find((player) => player.slug === normalized || slugify(player.name) === normalized) ?? null;
}

async function findBdlPlayerBySlug(slug: string): Promise<DashboardPlayer | null> {
  const payload = await balldontlieFetch('/players', { search: slug.replace(/-/g, ' '), per_page: '10' });
  const players = Array.isArray(payload?.data) ? payload.data : [];
  const exact = players.find((player: any) => slugify(`${player.first_name} ${player.last_name}`) === slug);
  const selected = exact ?? players[0];
  if (!selected) return null;
  return {
    playerId: selected.id,
    slug: slugify(`${selected.first_name} ${selected.last_name}`),
    name: `${selected.first_name} ${selected.last_name}`,
    team: selected.team?.abbreviation ?? '',
    position: selected.position ?? '',
    source: 'balldontlie'
  };
}

async function getNbaPlayerInfo(playerId: number) {
  const payload = await nbaFetch('commonplayerinfo', { LeagueID: '', PlayerID: String(playerId) });
  return (buildResultSetMap(payload).CommonPlayerInfo ?? [])[0] ?? null;
}

async function getNbaPlayerGameLog(playerId: number) {
  const payload = await nbaFetch('playergamelog', {
    DateFrom: '',
    DateTo: '',
    LeagueID: '00',
    PlayerID: String(playerId),
    Season: getSeasonString(),
    SeasonType: 'Regular Season'
  });
  return buildResultSetMap(payload).PlayerGameLog ?? [];
}

async function getNbaPlayerCareer(playerId: number) {
  const payload = await nbaFetch('playercareerstats', { LeagueID: '00', PerMode: 'PerGame', PlayerID: String(playerId) });
  return (buildResultSetMap(payload).CareerTotalsRegularSeason ?? [])[0] ?? null;
}

function computeOpponent(team: string, slate: DashboardGame[]): string | null {
  const game = slate.find((item) => item.homeTeam === team || item.awayTeam === team);
  if (!game) return null;
  return game.homeTeam === team ? game.awayTeam : game.homeTeam;
}

function buildContextFromGameLog(
  player: DashboardPlayer,
  market: string,
  gameLog: Record<string, unknown>[],
  info: Record<string, unknown> | null,
  career: Record<string, unknown> | null,
  line: number | null,
  slate: DashboardGame[]
): PickContextResponse {
  const statKey = market.toLowerCase() === 'points' ? 'PTS' : market.toUpperCase();
  const statValues = gameLog.map((row) => Number(row[statKey] ?? NaN));
  const homeValues = gameLog.filter((row) => String(row.MATCHUP ?? '').includes('vs')).map((row) => Number(row[statKey] ?? NaN));
  const awayValues = gameLog.filter((row) => String(row.MATCHUP ?? '').includes('@')).map((row) => Number(row[statKey] ?? NaN));
  const minutesLast5 = gameLog.slice(0, 5).map((row) => Number.parseFloat(String(row.MIN ?? '0'))).filter((value) => Number.isFinite(value));
  const careerAvg = career && career[statKey] !== undefined ? Number(career[statKey]) : null;
  const team = String(info?.TEAM_ABBREVIATION ?? player.team ?? '');

  return {
    player: player.name,
    sport: 'NBA',
    market: market.toUpperCase(),
    line,
    team,
    opponent: computeOpponent(team, slate),
    position: String(info?.POSITION ?? player.position ?? ''),
    season_avg: average(statValues),
    career_avg: Number.isFinite(Number(careerAvg)) ? Number(careerAvg) : null,
    last_10_avg: average(statValues.slice(0, 10)),
    home_split: average(homeValues),
    away_split: average(awayValues),
    minutes_last_5: minutesLast5,
    injury_context: {
      teammates_out: [],
      status: 'Active'
    },
    game_context: {
      spread: null,
      total: null,
      rest_days: null
    },
    source_timestamps: {
      odds_updated_at: new Date().toISOString(),
      stats_updated_at: new Date().toISOString()
    },
    source: 'nba'
  };
}

function buildContextFromBdlStats(player: DashboardPlayer, market: string, statsRows: any[], line: number | null, slate: DashboardGame[]): PickContextResponse {
  const statKey = market.toLowerCase() === 'points' ? 'pts' : market.toLowerCase();
  const statValues = statsRows.map((row) => Number(row[statKey] ?? NaN)).filter((value) => Number.isFinite(value));
  const minutesLast5 = statsRows.slice(0, 5).map((row) => Number.parseFloat(String(row.min ?? '0'))).filter((value) => Number.isFinite(value));
  const homeValues = statsRows.filter((row) => row.game?.home_team_id === row.team?.id).map((row) => Number(row[statKey] ?? NaN)).filter((value) => Number.isFinite(value));
  const awayValues = statsRows.filter((row) => row.game?.visitor_team_id === row.team?.id).map((row) => Number(row[statKey] ?? NaN)).filter((value) => Number.isFinite(value));

  return {
    player: player.name,
    sport: 'NBA',
    market: market.toUpperCase(),
    line,
    team: player.team,
    opponent: computeOpponent(player.team, slate),
    position: player.position,
    season_avg: average(statValues),
    career_avg: null,
    last_10_avg: average(statValues.slice(0, 10)),
    home_split: average(homeValues),
    away_split: average(awayValues),
    minutes_last_5: minutesLast5,
    injury_context: {
      teammates_out: [],
      status: 'Active'
    },
    game_context: {
      spread: null,
      total: null,
      rest_days: null
    },
    source_timestamps: {
      odds_updated_at: new Date().toISOString(),
      stats_updated_at: new Date().toISOString()
    },
    source: 'balldontlie'
  };
}

async function getBdlPlayerStats(player: DashboardPlayer, market: string, line: number | null, slate: DashboardGame[]) {
  const payload = await balldontlieFetch('/stats', {
    player_ids: [String(player.playerId)],
    per_page: '100',
    seasons: [String(new Date().getUTCFullYear() - 1)],
    postseason: 'false'
  });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return buildContextFromBdlStats(player, market, rows, line, slate);
}

export async function getLivePickContext(playerSlug: string, market: string, line: number | null): Promise<PickContextResponse> {
  const slate = await getLiveSlate();

  try {
    const player = await findNbaPlayerBySlug(playerSlug);
    if (player && typeof player.playerId === 'number' && Number.isFinite(player.playerId)) {
      const [info, gameLog, career] = await Promise.all([
        getNbaPlayerInfo(player.playerId),
        getNbaPlayerGameLog(player.playerId),
        getNbaPlayerCareer(player.playerId)
      ]);
      return buildContextFromGameLog(player, market, gameLog, info, career, line, slate);
    }
  } catch {
    // use fallback below
  }

  try {
    const player = await findBdlPlayerBySlug(playerSlug);
    if (player) {
      return await getBdlPlayerStats(player, market, line, slate);
    }
  } catch {
    // use fallback below
  }

  return {
    player: playerSlug.replace(/-/g, ' '),
    sport: 'NBA',
    market: market.toUpperCase(),
    line,
    team: '',
    opponent: null,
    position: '',
    season_avg: null,
    career_avg: null,
    last_10_avg: null,
    home_split: null,
    away_split: null,
    minutes_last_5: [],
    injury_context: {
      teammates_out: [],
      status: 'Unknown'
    },
    game_context: {
      spread: null,
      total: null,
      rest_days: null
    },
    source_timestamps: {
      odds_updated_at: new Date().toISOString(),
      stats_updated_at: new Date().toISOString()
    },
    source: 'fallback',
    notes: ['Live NBA and BALLDONTLIE lookups both failed for this player on the server.']
  };
}
