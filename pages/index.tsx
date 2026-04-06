import React from 'react';

export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h1>Prop Edge Live NBA MVP</h1>
      <p>
        This version replaces the fake games and fake player stats with live server-side calls. It tries NBA stats first and then BALLDONTLIE if the NBA request fails.
      </p>
      <ul>
        <li><a href="/dashboard">Open dashboard</a></li>
        <li><a href="/api/health">API health</a></li>
        <li><a href="/api/slate">Live slate JSON</a></li>
        <li><a href="/api/players?limit=20">Live players JSON</a></li>
      </ul>
      <p>Add <code>BALLDONTLIE_API_KEY</code> in Render if you want fallback support.</p>
    </div>
  );
}
