import React, { useEffect, useMemo, useState } from 'react';

type Sport = 'NBA' | 'MLB' | 'NHL';

type Game = {
  id: string;
  sport: 'NBA';
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  source: string;
};

type Player = {
  playerId: number | string;
  slug: string;
  name: string;
  team: string;
  position: string;
  source: string;
};

type PickContext = {
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
  source: string;
  notes: string[];
  errors: string[];
};

type SlateResponse = {
  games: Game[];
};

type PlayersResponse = {
  players: Player[];
};

type InjuryRow = {
  playerName: string;
  team: string;
  status: string;
  injuryType: string;
  updatedAt: string;
};

type DashboardInjuriesResponse = {
  injuries: InjuryRow[];
};

const TEAM_META: Record<string, { division: string; tz: number }> = {
  ATL: { division: 'Southeast', tz: -5 }, BOS: { division: 'Atlantic', tz: -5 }, BKN: { division: 'Atlantic', tz: -5 }, CHA: { division: 'Southeast', tz: -5 },
  CHI: { division: 'Central', tz: -6 }, CLE: { division: 'Central', tz: -5 }, DAL: { division: 'Southwest', tz: -6 }, DEN: { division: 'Northwest', tz: -7 },
  DET: { division: 'Central', tz: -5 }, GSW: { division: 'Pacific', tz: -8 }, HOU: { division: 'Southwest', tz: -6 }, IND: { division: 'Central', tz: -5 },
  LAC: { division: 'Pacific', tz: -8 }, LAL: { division: 'Pacific', tz: -8 }, MEM: { division: 'Southwest', tz: -6 }, MIA: { division: 'Southeast', tz: -5 },
  MIL: { division: 'Central', tz: -6 }, MIN: { division: 'Northwest', tz: -6 }, NOP: { division: 'Southwest', tz: -6 }, NYK: { division: 'Atlantic', tz: -5 },
  OKC: { division: 'Northwest', tz: -6 }, ORL: { division: 'Southeast', tz: -5 }, PHI: { division: 'Atlantic', tz: -5 }, PHX: { division: 'Pacific', tz: -7 },
  POR: { division: 'Northwest', tz: -8 }, SAC: { division: 'Pacific', tz: -8 }, SAS: { division: 'Southwest', tz: -6 }, TOR: { division: 'Atlantic', tz: -5 },
  UTA: { division: 'Northwest', tz: -7 }, WAS: { division: 'Southeast', tz: -5 }
};

const panelStyle: React.CSSProperties = {
  border: '1px solid #dcdcdc',
  borderRadius: 12,
  background: '#fff',
  padding: 14
};

function toEtTime(value: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return 'Unknown';
  }
}

function formatNumber(value: number | null, digits = 1): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  return value.toFixed(digits);
}

function getSeasonSegment(date = new Date()): string {
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: '2-digit' }).format(date));
  if (month <= 11 && month >= 10) return 'Early';
  if (month >= 3 && month <= 4) return 'Playoff Push';
  return 'Mid';
}

function computeProjection(context: PickContext): number | null {
  const lastGameProxy = context.last_10_avg;
  if (context.career_avg == null || context.season_avg == null || lastGameProxy == null) return null;
  return (context.career_avg * 0.855) + (context.season_avg * 0.142) + (lastGameProxy * 0.003);
}

function computeGap(projection: number | null, line: number | null): number | null {
  if (projection == null || line == null || line === 0) return null;
  return (Math.abs(projection - line) / line) * 100;
}

function getBetStatus(gap: number | null, market: string): string {
  if (gap == null) return 'NO BET';
  const isComposite = market.toLowerCase().includes('pra');
  const betThreshold = isComposite ? 20 : 10;
  if (gap >= 20) return 'STRONG BET';
  if (gap >= betThreshold) return 'BET';
  return 'NO BET';
}

function getDirection(projection: number | null, line: number | null): 'OVER' | 'UNDER' {
  if (projection == null || line == null) return 'UNDER';
  return projection >= line ? 'OVER' : 'UNDER';
}

function getConfidence(gap: number | null): number {
  if (gap == null) return 51;
  if (gap >= 20) return 70;
  if (gap >= 15) return 65;
  if (gap >= 10) return 60;
  if (gap >= 5) return 55;
  return 52;
}

export default function DashboardPage() {
  const [sport, setSport] = useState<Sport>('NBA');
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [injuries, setInjuries] = useState<InjuryRow[]>([]);
  const [contexts, setContexts] = useState<Record<string, PickContext>>({});
  const [pendingPlayerSlugs, setPendingPlayerSlugs] = useState<string[]>([]);
  const [selectedPlayerSlugs, setSelectedPlayerSlugs] = useState<string[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function load() {
      setLoadError('');
      try {
        const [slateRes, playersRes, injuriesRes] = await Promise.all([
          fetch('/api/slate'),
          fetch('/api/players?limit=250'),
          fetch('/api/injuries')
        ]);
        if (!slateRes.ok || !playersRes.ok || !injuriesRes.ok) throw new Error('Failed to load dashboard modules.');

        const slateJson = (await slateRes.json()) as SlateResponse;
        const playersJson = (await playersRes.json()) as PlayersResponse;
        const injuriesJson = (await injuriesRes.json()) as DashboardInjuriesResponse;

        setGames(slateJson.games ?? []);
        setPlayers(playersJson.players ?? []);
        setInjuries(injuriesJson.injuries ?? []);
        if (slateJson.games?.length) setSelectedGameId((prev) => prev || slateJson.games[0].id);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard.');
      }
    }

    load();
  }, [selectedGameId]);

  const selectedGame = useMemo(() => games.find((game) => game.id === selectedGameId) ?? null, [games, selectedGameId]);

  const selectedGame = useMemo(() => games.find((game) => game.id === selectedGameId) ?? null, [games, selectedGameId]);

  const selectedGame = useMemo(() => games.find((game) => game.id === selectedGameId) ?? null, [games, selectedGameId]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return players.filter((player) => `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(query));
  }, [players, search]);

  const filteredInjuries = useMemo(() => {
    if (!selectedGame) return injuries;
    return injuries.filter((row) => row.team === selectedGame.homeTeam || row.team === selectedGame.awayTeam);
  }, [injuries, selectedGame]);

  const selectedContexts = selectedPlayerSlugs.map((slug) => contexts[slug]).filter(Boolean);

  const gameComputed = useMemo(() => {
    if (!selectedGame) return null;
    const awayMeta = TEAM_META[selectedGame.awayTeam];
    const homeMeta = TEAM_META[selectedGame.homeTeam];
    const tzDiff = awayMeta && homeMeta ? Math.abs(awayMeta.tz - homeMeta.tz) : null;
    const divisionGame = Boolean(awayMeta && homeMeta && awayMeta.division === homeMeta.division);
    const tipHourEt = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(new Date(selectedGame.startTime)));
    const leadContext = selectedContexts[0];

    return {
      travelFlag: tzDiff != null && (tzDiff >= 2 || tipHourEt <= 10) ? 'Concern' : 'No major concern',
      seasonSegment: getSeasonSegment(new Date(selectedGame.startTime)),
      divisionGame: divisionGame ? 'Y' : 'N',
      spread: leadContext?.game_context?.spread ?? null,
      total: leadContext?.game_context?.total ?? null,
      restDays: leadContext?.game_context?.rest_days ?? null
    };
  }, [selectedGame, selectedContexts]);

  async function addPlayer(player: Player) {
    if (selectedPlayerSlugs.includes(player.slug) || pendingPlayerSlugs.includes(player.slug)) return;

    setSelectedPlayerSlugs((prev) => [...prev, player.slug]);
    setPendingPlayerSlugs((prev) => [...prev, player.slug]);

    try {
      const response = await fetch(`/api/pick-context/nba/${player.slug}/points`);
      const payload = (await response.json()) as PickContext | { error: string };
      if (!response.ok || 'error' in payload) throw new Error('Unable to load player data.');
      setContexts((prev) => ({ ...prev, [player.slug]: payload }));
    } catch {
      setCopyStatus(`Failed to load ${player.name}.`);
    } finally {
      setPendingPlayerSlugs((prev) => prev.filter((slug) => slug !== player.slug));
    }
  }

  function removePlayer(slug: string) {
    setSelectedPlayerSlugs((prev) => prev.filter((entry) => entry !== slug));
  }

  const sessionBrief = useMemo(() => {
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'America/New_York'
    }).format(new Date());

    const lines: string[] = [`=== PROP EDGE SESSION BRIEF — ${dateLabel} ===`, ''];

    if (selectedGame && gameComputed) {
      lines.push(
        `GAME: ${selectedGame.awayTeam} @ ${selectedGame.homeTeam} | ${toEtTime(selectedGame.startTime)} ET | Spread: ${formatNumber(gameComputed.spread)} | Total: ${formatNumber(gameComputed.total)}`,
        `Pace: ${selectedGame.awayTeam} #N/A (N/A) | ${selectedGame.homeTeam} #N/A (N/A) | Division game: ${gameComputed.divisionGame} | Travel: ${gameComputed.travelFlag}`,
        `Team O/U trend: ${selectedGame.awayTeam} N/A | ${selectedGame.homeTeam} N/A | Season segment: ${gameComputed.seasonSegment}`,
        ''
      );
    }

    for (const context of selectedContexts) {
      const projection = computeProjection(context);
      const gap = computeGap(projection, context.line);
      const direction = getDirection(projection, context.line);
      const confidence = getConfidence(gap);
      const betStatus = getBetStatus(gap, context.market);

      lines.push(
        `PLAYER: ${context.player} | ${context.team || 'UNK'} | ${context.position || 'N/A'}`,
        `Career pts avg: ${formatNumber(context.career_avg)} | Season avg: ${formatNumber(context.season_avg)} | Last game: ${formatNumber(context.last_10_avg)}`,
        `Usage: N/A | Min/game: N/A (season) | L5 min: ${context.minutes_last_5.length ? context.minutes_last_5.join(', ') : 'N/A'}`,
        `Home/Away split: Home ${formatNumber(context.home_split)} / Away ${formatNumber(context.away_split)} | Tonight: ${selectedGame ? (context.team === selectedGame.homeTeam ? 'Home' : 'Away') : 'N/A'}`,
        `TS%: N/A | B2B tonight: ${context.game_context?.rest_days === 0 ? 'Y' : 'N'}`,
        `Status: ${context.injury_context?.status ?? 'Unknown'} | Key teammate out: ${context.injury_context?.teammates_out?.length ? context.injury_context.teammates_out.join(', ') : 'None'}`,
        '',
        `MATCHUP vs ${context.opponent ?? 'N/A'}:`,
        `Positional allowed: N/A | Opponent L5 def rating: N/A`,
        `H2H last 5: N/A | Revenge game: N/A`,
        '',
        `LINE: ${formatNumber(context.line)} pts | Open: N/A | Current: ${formatNumber(context.line)} | Odds: OVER N/A / UNDER N/A`,
        `MODEL: Projection ${formatNumber(projection)} | Gap ${formatNumber(gap)}% | Direction ${direction} | Confidence ${confidence}% | ${betStatus}`,
        ''
      );
    }

    return lines.join('\n');
  }, [gameComputed, selectedContexts, selectedGame]);

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(sessionBrief);
      setCopyStatus('Session brief copied to clipboard.');
    } catch {
      setCopyStatus('Copy failed (clipboard permission denied).');
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 24, background: '#f8f8f8', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0 }}>Prop Edge Model — Data Access Dashboard</h1>
      <p style={{ color: '#555' }}>Version aligned for Skill v3.2 workflow (NBA primary, MLB/NHL modules included as seasonal blocks).</p>
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="sport" style={{ marginRight: 8 }}>Sport:</label>
        <select id="sport" value={sport} onChange={(event) => setSport(event.target.value as Sport)}>
          <option value="NBA">NBA</option>
          <option value="MLB">MLB</option>
          <option value="NHL">NHL</option>
        </select>
      </div>
      {loadError ? <p style={{ color: '#b00020' }}>{loadError}</p> : null}

      {sport === 'NBA' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
            <section style={{ ...panelStyle, maxHeight: '70vh', overflow: 'auto' }}>
              <h2 style={{ marginTop: 0 }}>Tonight&apos;s Games</h2>
              {games.map((game) => (
                <button
                  type="button"
                  key={game.id}
                  onClick={() => setSelectedGameId(game.id)}
                  style={{
                    width: '100%', textAlign: 'left', marginBottom: 8, borderRadius: 10, padding: 10, cursor: 'pointer',
                    border: selectedGameId === game.id ? '2px solid #2563eb' : '1px solid #d8d8d8', background: '#fff'
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{game.awayTeam} @ {game.homeTeam}</div>
                  <div style={{ color: '#555', marginTop: 4 }}>{toEtTime(game.startTime)} ET • {game.status}</div>
                </button>
              ))}
            </section>

            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Add Players</h2>
              <input
                type="text"
                placeholder="Search players..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: '100%', maxWidth: 360, marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
                {filteredPlayers.slice(0, 36).map((player) => {
                  const isSelected = selectedPlayerSlugs.includes(player.slug);
                  const isLoading = pendingPlayerSlugs.includes(player.slug);
                  return (
                    <button
                      type="button"
                      key={player.slug}
                      onClick={() => addPlayer(player)}
                      disabled={isSelected || isLoading}
                      style={{ ...panelStyle, padding: 10, textAlign: 'left', cursor: isSelected ? 'default' : 'pointer' }}
                    >
                      <div style={{ fontWeight: 700 }}>{player.name}</div>
                      <div style={{ color: '#666', marginTop: 4 }}>{player.team || 'Team TBD'} {player.position ? `• ${player.position}` : ''}</div>
                      <span
                        style={{ display: 'inline-block', marginTop: 8, borderRadius: 8, border: '1px solid #2563eb', background: isSelected ? '#dbeafe' : '#eff6ff', padding: '6px 10px' }}
                      >
                        {isLoading ? 'Loading...' : isSelected ? 'Added' : 'Add Player'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!filteredPlayers.length ? <p style={{ color: '#666' }}>No players returned. Check API configuration or remove your search filter.</p> : null}
            </section>
          </div>

          <section style={{ ...panelStyle, marginTop: 16 }}>
            <h2 style={{ marginTop: 0 }}>Module 1 — Tonight&apos;s Game Context</h2>
            {selectedGame && gameComputed ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                <div><strong>Tip:</strong> {toEtTime(selectedGame.startTime)} ET</div>
                <div><strong>Spread:</strong> {formatNumber(gameComputed.spread)}</div>
                <div><strong>Total:</strong> {formatNumber(gameComputed.total)}</div>
                <div><strong>Division game:</strong> {gameComputed.divisionGame}</div>
                <div><strong>Travel context:</strong> {gameComputed.travelFlag}</div>
                <div><strong>Season segment:</strong> {gameComputed.seasonSegment}</div>
                <div><strong>B2B rest days (from context):</strong> {formatNumber(gameComputed.restDays, 0)}</div>
                <div><strong>Team O/U trend:</strong> N/A (source not wired yet)</div>
              </div>
            ) : <p>Select a game.</p>}
          </section>

          <section style={{ ...panelStyle, marginTop: 16 }}>
            <h2 style={{ marginTop: 0 }}>Module 2/3/4 — Player, Matchup, Line Data</h2>
            {!selectedPlayerSlugs.length ? <p>Add players from the top-right panel.</p> : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {selectedPlayerSlugs.map((slug) => {
                const context = contexts[slug];
                if (!context) {
                  return (
                    <div key={slug} style={panelStyle}>
                      <strong>Loading player card...</strong>
                    </div>
                  );
                }

                const projection = computeProjection(context);
                const gap = computeGap(projection, context.line);
                const direction = getDirection(projection, context.line);
                const confidence = getConfidence(gap);
                const betStatus = getBetStatus(gap, context.market);

                return (
                  <div key={slug} style={panelStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{context.player}</strong>
                      <button type="button" onClick={() => removePlayer(slug)} style={{ border: 'none', borderRadius: 8, cursor: 'pointer', background: '#fee2e2' }}>Remove</button>
                    </div>
                    <p style={{ color: '#555' }}>{context.team} • {context.position || 'N/A'} • vs {context.opponent ?? 'N/A'}</p>
                    <ul>
                      <li>Career avg: {formatNumber(context.career_avg)}</li>
                      <li>Season avg: {formatNumber(context.season_avg)}</li>
                      <li>Last 10 avg: {formatNumber(context.last_10_avg)}</li>
                      <li>Home/Away split: {formatNumber(context.home_split)} / {formatNumber(context.away_split)}</li>
                      <li>L5 min trend: {context.minutes_last_5.length ? context.minutes_last_5.join(', ') : 'N/A'}</li>
                      <li>Status: {context.injury_context.status}</li>
                      <li>Spread/Total: {formatNumber(context.game_context.spread)} / {formatNumber(context.game_context.total)}</li>
                      <li>Current line: {formatNumber(context.line)}</li>
                      <li>Opening line: N/A (not wired)</li>
                      <li>Odds: N/A (not wired)</li>
                      <li>Positional defense: N/A (not wired)</li>
                      <li>Model projection: {formatNumber(projection)} | Gap: {formatNumber(gap)}% | {direction} {confidence}% | {betStatus}</li>
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={{ ...panelStyle, marginTop: 16 }}>
            <h2 style={{ marginTop: 0 }}>Module 5 — Injury Feed</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Player</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Team</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Type</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInjuries.slice(0, 30).map((row) => (
                    <tr key={`${row.playerName}-${row.updatedAt}`}>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{row.playerName}</td>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{row.team}</td>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{row.status}</td>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{row.injuryType}</td>
                      <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{row.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {sport === 'MLB' ? (
        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Module 6 — MLB Seasonal Block</h2>
          <p>Planned fields: pitcher SwStr%, K/9, GB%, BB/9, handedness, innings limit flag, umpire K tendency, park/weather, opponent K% split.</p>
          <p>This view is scaffolded and ready for MLB API wiring.</p>
        </section>
      ) : null}

      {sport === 'NHL' ? (
        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Module 7 — NHL Block</h2>
          <p>Planned fields: confirmed starting goalie, shots-against, PP/PK rates, and player PP TOI.</p>
          <p>This view is scaffolded and ready for NHL API wiring.</p>
        </section>
      ) : null}

      <section style={{ ...panelStyle, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Option A — Copy Session Brief</h2>
        <button type="button" onClick={copyBrief} style={{ border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', padding: '10px 14px', cursor: 'pointer' }}>
          Copy Session Brief
        </button>
        {copyStatus ? <p style={{ color: '#555' }}>{copyStatus}</p> : null}
        <textarea value={sessionBrief} readOnly style={{ width: '100%', minHeight: 320, marginTop: 10, borderRadius: 8, border: '1px solid #ccc', padding: 12 }} />
      </section>
    </div>
  );
}
