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

const cellStyle: React.CSSProperties = {
  borderBottom: '1px solid #e5e5e5',
  textAlign: 'left',
  padding: '12px 10px'
};

const panelStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  marginTop: 16
};

export default function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slateMeta, setSlateMeta] = useState<{ source?: string; notes: string[]; errors: string[]; requestedDate?: string; actualDate?: string }>({
    notes: [],
    errors: []
  });
  const [playersMeta, setPlayersMeta] = useState<{ source?: string; notes: string[]; errors: string[] }>({
    notes: [],
    errors: []
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [slateRes, playersRes] = await Promise.all([
          fetch('/api/slate'),
          fetch('/api/players?limit=250')
        ]);

        if (!slateRes.ok) {
          const payload = await slateRes.json().catch(() => ({ error: 'Unable to load slate.' }));
          throw new Error(payload.error ?? 'Unable to load slate.');
        }
        if (!playersRes.ok) {
          const payload = await playersRes.json().catch(() => ({ error: 'Unable to load players.' }));
          throw new Error(payload.error ?? 'Unable to load players.');
        }

        const slateJson = (await slateRes.json()) as SlateResponse;
        const playersJson = (await playersRes.json()) as PlayersResponse;

        setGames(Array.isArray(slateJson.games) ? slateJson.games : []);
        setPlayers(Array.isArray(playersJson.players) ? playersJson.players : []);
        setSlateMeta({
          source: slateJson.source,
          notes: slateJson.notes ?? [],
          errors: slateJson.errors ?? [],
          requestedDate: slateJson.requestedDate,
          actualDate: slateJson.actualDate
        });
        setPlayersMeta({
          source: playersJson.source,
          notes: playersJson.notes ?? [],
          errors: playersJson.errors ?? []
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load live NBA data.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return players;
    return players.filter((player) => `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(query));
  }, [players, search]);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>Prop Edge NBA Dashboard</h1>
      <p style={{ marginTop: 0, color: '#555' }}>
        This version uses a dedicated Python NBA service powered by <code>nba_api</code>. The web app reads the slate, active player directory,
        and pick context through your own API routes.
      </p>
      {loading ? <p>Loading live NBA data...</p> : null}
      {error ? <p style={{ color: '#b00020' }}>{error}</p> : null}

      <section style={{ marginTop: 24 }}>
        <h2>Today&apos;s Games</h2>
        <div style={panelStyle}>
          <div><strong>Source:</strong> {slateMeta.source ?? 'Unknown'}</div>
          <div><strong>Requested Date:</strong> {slateMeta.requestedDate ?? 'Unknown'}</div>
          <div><strong>Actual Date:</strong> {slateMeta.actualDate ?? 'Unknown'}</div>
          {slateMeta.notes.length ? (
            <div style={{ marginTop: 12 }}>
              <strong>Notes</strong>
              <ul>{slateMeta.notes.map((note) => <li key={note}>{note}</li>)}</ul>
            </div>
          ) : null}
          {slateMeta.errors.length ? (
            <div style={{ marginTop: 12, color: '#b00020' }}>
              <strong>Errors</strong>
              <ul>{slateMeta.errors.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}
        </div>
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={cellStyle}>Matchup</th>
                <th style={cellStyle}>Start</th>
                <th style={cellStyle}>Status</th>
                <th style={cellStyle}>Source</th>
              </tr>
            </thead>
            <tbody>
              {games.length ? games.map((game) => (
                <tr key={game.id}>
                  <td style={cellStyle}>{game.awayTeam} @ {game.homeTeam}</td>
                  <td style={cellStyle}>{new Date(game.startTime).toLocaleString()}</td>
                  <td style={cellStyle}>{game.status}</td>
                  <td style={cellStyle}>{game.source}</td>
                </tr>
              )) : (
                <tr><td style={cellStyle} colSpan={4}>No live NBA games were returned by the NBA service.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Players</h2>
        <div style={panelStyle}>
          <div><strong>Source:</strong> {playersMeta.source ?? 'Unknown'}</div>
          {playersMeta.notes.length ? (
            <div style={{ marginTop: 12 }}>
              <strong>Notes</strong>
              <ul>{playersMeta.notes.map((note) => <li key={note}>{note}</li>)}</ul>
            </div>
          ) : null}
          {playersMeta.errors.length ? (
            <div style={{ marginTop: 12, color: '#b00020' }}>
              <strong>Errors</strong>
              <ul>{playersMeta.errors.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}
        </div>
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: '100%', maxWidth: 360, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', margin: '16px 0' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {filteredPlayers.map((player) => (
            <a
              key={String(player.playerId)}
              href={`/player/${player.slug}`}
              style={{ textDecoration: 'none', color: 'inherit', border: '1px solid #ddd', borderRadius: 12, padding: 16, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div style={{ fontWeight: 700 }}>{player.name}</div>
              <div style={{ color: '#555', marginTop: 4 }}>
                {player.team || 'Team populated on detail page'} {player.position ? `• ${player.position}` : ''}
              </div>
              <div style={{ color: '#777', marginTop: 8, fontSize: 12 }}>Source: {player.source}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
