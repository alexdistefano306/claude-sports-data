import React from 'react';

const Home: React.FC = () => {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Prop Edge Dashboard MVP</h1>
      <p>
        This is a starter dashboard for the sports pick evaluation project.
      </p>
      <p>
        Use the <code>/api/slate</code> endpoint to fetch today's games and the{' '}
        <code>/api/pick-context</code> endpoint for detailed pick context.
      </p>
      <p>
        For example, try visiting{' '}
        <a href="/api/health" target="_blank" rel="noopener noreferrer">
          /api/health
        </a>{' '}
        to see the health check.
      </p>
      <p>
        Explore the{' '}
        <a href="/dashboard" rel="noopener noreferrer">
          dashboard
        </a>{' '}
        for an interactive view of the slate and players.
      </p>
    </div>
  );
};

export default Home;