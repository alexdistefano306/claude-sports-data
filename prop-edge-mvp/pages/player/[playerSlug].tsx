import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

interface PickContext {
  player: string;
  sport: string;
  market: string;
  line: number;
  team: string;
  opponent: string;
  season_avg: number;
  career_avg: number;
  last_10_avg: number;
  home_split: number;
  away_split: number;
  minutes_last_5: number[];
  injury_context: {
    teammates_out: string[];
    status: string;
  };
  game_context: {
    spread: number;
    total: number;
    rest_days: number;
  };
}

const PlayerPage: React.FC = () => {
  const router = useRouter();
  const { playerSlug } = router.query;
  const [context, setContext] = useState<PickContext | null>(null);

  useEffect(() => {
    if (!playerSlug) return;
    fetch(`/api/pick-context/nba/${playerSlug}/points`)
      .then((res) => res.json())
      .then((data) => setContext(data))
      .catch((err) => console.error('Error loading pick context', err));
  }, [playerSlug]);

  if (!playerSlug || !context) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>
        {context.player} ({context.market})
      </h1>
      <p>
        <strong>Team:</strong> {context.team}
      </p>
      <p>
        <strong>Opponent:</strong> {context.opponent}
      </p>
      <p>
        <strong>Line:</strong> {context.line}
      </p>
      <p>
        <strong>Season Avg:</strong> {context.season_avg}
      </p>
      <p>
        <strong>Career Avg:</strong> {context.career_avg}
      </p>
      <p>
        <strong>Last 10 Avg:</strong> {context.last_10_avg}
      </p>
      <p>
        <strong>Home Split:</strong> {context.home_split}
      </p>
      <p>
        <strong>Away Split:</strong> {context.away_split}
      </p>
      <p>
        <strong>Minutes Last 5:</strong> {context.minutes_last_5.join(', ')}
      </p>
      <p>
        <strong>Spread:</strong> {context.game_context.spread}
      </p>
      <p>
        <strong>Total:</strong> {context.game_context.total}
      </p>
      <p>
        <strong>Injury Context:</strong>{' '}
        {context.injury_context.teammates_out.length > 0
          ? context.injury_context.teammates_out.join(', ')
          : 'None'}
      </p>
    </div>
  );
};

export default PlayerPage;