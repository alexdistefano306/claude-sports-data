import React, { useEffect, useMemo, useState } from 'react';

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
  source: string;
  requestedDate: string;
  actualDate: string;
  errors: string[];
  notes: string[];
};

type PlayersResponse = {
  players: Player[];
  source: string;
  errors: string[];
  notes: string[];
};

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

function toEt(value: string): string {
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

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #dcdcdc',
  borderRadius: 12,
  background: '#fff',
  padding: 14
};

export default function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [injuries, setInjuries] = useState<InjuryRow[]>([]);
  const [contexts, setContexts] = useState<Record<string, PickContext>>({});
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [selectedPlayerSlugs, setSelectedPlayerSlugs] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    async function load() {
      setLoadError('');
      try {
        const [slateRes, playersRes, injuriesRes] = await Promise.all([
          fetch('/api/slate'),
          fetch('/api/players?limit=250'),
          fetch('/api/injuries')
        ]);

        if (!slateRes.ok || !playersRes.ok || !injuriesRes.ok) {
          throw new Error('Failed to load one or more dashboard data modules.');
        }

        const slateJson = (await slateRes.json()) as SlateResponse;
        const playersJson = (await playersRes.json()) as PlayersResponse;
        const injuriesJson = (await injuriesRes.json()) as InjuriesResponse;

        setGames(slateJson.games ?? []);
        setPlayers(playersJson.players ?? []);
        setInjuries(injuriesJson.injuries ?? []);
        if (!selectedGameId && slateJson.games?.length) {
          setSelectedGameId(slateJson.games[0].id);
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard modules.');
      }
    }

    load();
  }, [selectedGameId]);

  const selectedGame = useMemo(() => games.find((game) => game.id === selectedGameId) ?? null, [games, selectedGameId]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return players;
    return players.filter((player) => `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(query));
  }, [players, search]);

  const filteredInjuries = useMemo(() => {
    if (!selectedGame) return injuries;
    return injuries.filter((injury) => injury.team === selectedGame.homeTeam || injury.team === selectedGame.awayTeam);
  }, [injuries, selectedGame]);

  async function addPlayer(player: Player) {
    if (selectedPlayerSlugs.includes(player.slug)) return;
    setSelectedPlayerSlugs((prev) => [...prev, player.slug]);
    try {
      const response = await fetch(`/api/pick-context/nba/${player.slug}/points`);
      const payload = (await response.json()) as PickContext | { error: string };
      if (!response.ok || 'error' in payload) {
        throw new Error('Unable to load player card context.');
      }
      setContexts((prev) => ({ ...prev, [player.slug]: payload }));
    } catch {
      setCopyStatus(`Warning: failed to hydrate ${player.name} context.`);
    }
  }

  function removePlayer(slug: string) {
    setSelectedPlayerSlugs((prev) => prev.filter((entry) => entry !== slug));
  }

  const selectedContexts = selectedPlayerSlugs.map((slug) => contexts[slug]).filter(Boolean);

  const sessionBrief = useMemo(() => {
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'America/New_York'
    }).format(new Date());

    const lines: string[] = [`=== PROP EDGE SESSION BRIEF — ${dateLabel} ===`, ''];

    if (selectedGame) {
      const leadContext = selectedContexts[0];
      lines.push(
        `GAME: ${selectedGame.awayTeam} @ ${selectedGame.homeTeam} | ${toEt(selectedGame.startTime)} ET | Spread: ${formatNumber(leadContext?.game_context?.spread)} | Total: ${formatNumber(leadContext?.game_context?.total)}`,
        `Pace: ${selectedGame.awayTeam} #N/A (N/A) | ${selectedGame.homeTeam} #N/A (N/A) | Division game: N/A | Travel: N/A`,
        `Team O/U trend: ${selectedGame.awayTeam} N/A | ${selectedGame.homeTeam} N/A | Season segment: N/A`,
        ''
      );
    }

    for (const context of selectedContexts) {
      lines.push(
        `PLAYER: ${context.player} | ${context.team || 'UNK'} | ${context.position || 'N/A'}`,
        `Career pts avg: ${formatNumber(context.career_avg)} | Season avg: ${formatNumber(context.season_avg)} | Last game: N/A`,
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
        ''
      );
    }

    return lines.join('\n');
  }, [selectedGame, selectedContexts]);

  async function onCopyBrief() {
    try {
      await copyText(sessionBrief);
      setCopyStatus('Session brief copied to clipboard.');
    } catch {
      setCopyStatus('Copy failed. Your browser blocked clipboard access.');
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 24, background: '#f8f8f8', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0 }}>Prop Edge Model — Data Access Dashboard</h1>
      <p style={{ color: '#555' }}>Single-page, copy-ready context builder for Claude prop sessions.</p>
      {loadError ? <p style={{ color: '#b00020' }}>{loadError}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        <section style={{ ...panelStyle, maxHeight: '72vh', overflow: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>Tonight&apos;s Games</h2>
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGameId(game.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                marginBottom: 8,
                border: game.id === selectedGameId ? '2px solid #2563eb' : '1px solid #d8d8d8',
                borderRadius: 10,
                padding: 10,
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: 700 }}>{game.awayTeam} @ {game.homeTeam}</div>
              <div style={{ color: '#555', marginTop: 4 }}>{toEt(game.startTime)} ET • {game.status}</div>
            </button>
          ))}
          {!games.length ? <p>No games returned.</p> : null}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Player Cards</h2>
          <input
            type="text"
            placeholder="Search players to add..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: '100%', maxWidth: 360, marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10, marginBottom: 16 }}>
            {filteredPlayers.slice(0, 24).map((player) => (
              <button key={player.slug} onClick={() => addPlayer(player)} style={{ ...panelStyle, cursor: 'pointer', padding: 10 }}>
                <div style={{ fontWeight: 700 }}>{player.name}</div>
                <div style={{ color: '#666', marginTop: 4 }}>{player.team || 'Team TBD'} {player.position ? `• ${player.position}` : ''}</div>
              </button>
            ))}
          </div>

          <h3>Selected Prop Cards</h3>
          {!selectedContexts.length ? <p style={{ color: '#666' }}>Add one or more players to generate cards + brief.</p> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {selectedPlayerSlugs.map((slug) => {
              const context = contexts[slug];
              if (!context) return null;
              return (
              <div key={slug} style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{context.player}</strong>
                  <button onClick={() => removePlayer(slug)} style={{ border: 'none', background: '#fee2e2', borderRadius: 8, cursor: 'pointer' }}>Remove</button>
                </div>
                <div style={{ color: '#666', marginTop: 6 }}>{context.team} • {context.position || 'N/A'} • vs {context.opponent ?? 'N/A'}</div>
                <ul style={{ marginBottom: 0 }}>
                  <li>Career: {formatNumber(context.career_avg)}</li>
                  <li>Season: {formatNumber(context.season_avg)}</li>
                  <li>L10 avg: {formatNumber(context.last_10_avg)}</li>
                  <li>Line: {formatNumber(context.line)}</li>
                  <li>L5 minutes: {context.minutes_last_5.length ? context.minutes_last_5.join(', ') : 'N/A'}</li>
                  <li>Status: {context.injury_context.status}</li>
                </ul>
              </div>
            )})}
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Injury Report Feed</h2>
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
              {filteredInjuries.slice(0, 20).map((injury) => (
                <tr key={`${injury.playerName}-${injury.updatedAt}`}>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{injury.playerName}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{injury.team}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{injury.status}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{injury.injuryType}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{injury.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredInjuries.length ? <p style={{ color: '#666' }}>No injuries matched the selected game; showing none.</p> : null}
        </div>
      </section>

      <section style={{ ...panelStyle, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Session Brief Builder (Option A)</h2>
        <button onClick={onCopyBrief} style={{ border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', padding: '10px 14px', cursor: 'pointer' }}>
          Copy Session Brief
        </button>
        {copyStatus ? <p style={{ color: '#555' }}>{copyStatus}</p> : null}
        <textarea value={sessionBrief} readOnly style={{ width: '100%', minHeight: 300, marginTop: 10, borderRadius: 8, border: '1px solid #ccc', padding: 12 }} />
      </section>
    </div>
  );
}
