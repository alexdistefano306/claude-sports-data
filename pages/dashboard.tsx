import React, { useEffect, useState } from 'react';

interface Game {
  id: number;
  sport: string;
  teams: [string, string];
  startTime: string;
}

interface Player {
  slug: string;
  name: string;
  team: string;
}

const Dashboard: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    fetch('/api/slate')
      .then((res) => res.json())
      .then((data) => setGames(data))
      .catch((err) => console.error('Error loading slate', err));
    fetch('/api/players')
      .then((res) => res.json())
      .then((data) => setPlayers(data))
      .catch((err) => console.error('Error loading players', err));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Sports Dashboard</h1>
      <h2>Today's Games</h2>
      <table border={1} cellPadding={6} cellSpacing={0}>
        <thead>
          <tr>
            <th>Sport</th>
            <th>Teams</th>
            <th>Start Time</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id}>
              <td>{game.sport}</td>
              <td>{game.teams.join(' vs ')}</td>
              <td>{new Date(game.startTime).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Players</h2>
      <ul>
        {players.map((player) => (
          <li key={player.slug}>
            <a href={`/player/${player.slug}`}>{player.name}</a> - {player.team}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;