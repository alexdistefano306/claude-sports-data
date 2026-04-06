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

const cellStyle: React.CSSProperties = {
  borderBottom: '1px solid #e5e5e5',
  textAlign: 'left',
  padding: '12px 10px'
};

export default function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [slateRes, playersRes] = await Promise.all([
          fetch('/api/slate'),
          fetch('/api/players?limit=80')
        ]);
        if (!slateRes.ok || !playersRes.ok) throw new Error('One of the live data requests failed.');
        const slateJson = await slateRes.json();
        const playersJson = await playersRes.json();
        setGames(Array.isArray(slateJson.games) ? slateJson.games : []);
        setPlayers(Array.isArray(playersJson.players) ? playersJson.players : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load live data.');
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
      <p style={{ marginTop: 0, color: '#555' }}>Live slate from the NBA stats feed when available, with BALLDONTLIE fallback if the NBA request fails.</p>
      {loading ? <p>Loading live data...</p> : null}
      {error ? <p style={{ color: '#b00020' }}>{error}</p> : null}

      <section style={{ marginTop: 32 }}>
        <h2>Today&apos;s Games</h2>
        <div style={{ overflowX: 'auto' }}>
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
                <tr><td style={cellStyle} colSpan={4}>No live NBA games were returned for this date.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Players</h2>
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: '100%', maxWidth: 360, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', marginBottom: 16 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {filteredPlayers.map((player) => (
            <a
              key={String(player.playerId)}
              href={`/player/${player.slug}`}
              style={{ textDecoration: 'none', color: 'inherit', border: '1px solid #ddd', borderRadius: 12, padding: 16, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div style={{ fontWeight: 700 }}>{player.name}</div>
              <div style={{ color: '#555', marginTop: 4 }}>{player.team || 'FA'} {player.position ? `• ${player.position}` : ''}</div>
              <div style={{ color: '#777', marginTop: 8, fontSize: 12 }}>Source: {player.source}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
