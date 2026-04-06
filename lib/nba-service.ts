export interface ServiceErrorResponse {
  error: string;
  errors?: string[];
  notes?: string[];
}

export interface DashboardGame {
  id: string;
  sport: 'NBA';
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  startTime: string;
  status: string;
  source: string;
}

export interface SlateResponse {
  sport: 'NBA';
  requestedDate: string;
  actualDate: string;
  games: DashboardGame[];
  source: string;
  errors: string[];
  notes: string[];
  updatedAt: string;
}

export interface DashboardPlayer {
  playerId: number | string;
  slug: string;
  name: string;
  team: string;
  position: string;
  source: string;
}

export interface PlayersResponse {
  players: DashboardPlayer[];
  source: string;
  errors: string[];
  notes: string[];
  updatedAt: string;
}

export interface PickContextResponse {
  player: string;
  playerId: number | string;
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
  source: string;
  errors: string[];
  notes: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  nbaServiceConfigured: boolean;
  nbaServiceUrl: string | null;
  upstream?: unknown;
  errors?: string[];
  timestamp: string;
}

function getBaseUrl(): string {
  const baseUrl = process.env.NBA_SERVICE_URL;
  if (!baseUrl) {
    throw new Error('NBA_SERVICE_URL is not configured on the web service.');
  }
  return baseUrl.replace(/\/$/, '');
}

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetchWithTimeout(`${getBaseUrl()}${path}`);
  if (!response.ok) {
    let payload: ServiceErrorResponse | null = null;
    try {
      payload = (await response.json()) as ServiceErrorResponse;
    } catch {
      payload = null;
    }
    throw new Error(payload?.error ?? `Upstream service error: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getUpstreamHealth(): Promise<unknown> {
  return fetchJson('/health');
}

export async function getLiveSlate(date?: string): Promise<SlateResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return fetchJson<SlateResponse>(`/nba/slate${query}`);
}

export async function getLivePlayers(limit = 100, search?: string): Promise<PlayersResponse> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (search) params.set('q', search);
  return fetchJson<PlayersResponse>(`/nba/players?${params.toString()}`);
}

export async function getPickContext(input: {
  sport: string;
  playerSlug: string;
  market: string;
  line?: string;
}): Promise<PickContextResponse> {
  const params = new URLSearchParams();
  params.set('playerSlug', input.playerSlug);
  params.set('market', input.market);
  if (input.line) params.set('line', input.line);
  return fetchJson<PickContextResponse>(`/nba/pick-context?${params.toString()}`);
}
