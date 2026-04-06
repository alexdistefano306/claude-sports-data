import React from 'react';

export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h1>Prop Edge NBA API Stack</h1>
      <p>
        This repo now contains two pieces: a Next.js dashboard at the root and a Python <code>nba_api</code> service in
        <code> /nba-service</code>. The dashboard proxies all NBA data through your own service instead of calling the NBA endpoints directly from Node.
      </p>
      <ul>
        <li><a href="/dashboard">Open dashboard</a></li>
        <li><a href="/api/health">API health</a></li>
        <li><a href="/api/slate">Slate JSON</a></li>
        <li><a href="/api/players?limit=20">Players JSON</a></li>
      </ul>
      <p>
        Set <code>NBA_SERVICE_URL</code> on the web service after you deploy the Python service.
      </p>
    </div>
  );
}
