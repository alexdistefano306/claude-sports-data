import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

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
  source: string;
  notes?: string[];
  errors?: string[];
};

function formatStat(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'N/A';
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, background: '#fff' }}>
      <div style={{ color: '#666', fontSize: 13 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function PlayerPage() {
  const router = useRouter();
  const { playerSlug } = router.query;
  const [context, setContext] = useState<PickContext | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (typeof playerSlug !== 'string') return;
      setError('');
      try {
        const response = await fetch(`/api/pick-context/nba/${playerSlug}/points`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Unable to load player context.');
        setContext(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load player context.');
      }
    }
    load();
  }, [playerSlug]);

  if (error) return <div style={{ padding: 32, fontFamily: 'Arial, sans-serif', color: '#b00020' }}>{error}</div>;
  if (!context) return <div style={{ padding: 32, fontFamily: 'Arial, sans-serif' }}>Loading player context...</div>;

  return (
    <div style={{ padding: 32, fontFamily: 'Arial, sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <a href="/dashboard" style={{ display: 'inline-block', marginBottom: 20 }}>← Back to dashboard</a>
      <h1 style={{ marginBottom: 8 }}>{context.player}</h1>
      <p style={{ marginTop: 0, color: '#555' }}>{context.team || 'Unknown Team'} {context.position ? `• ${context.position}` : ''} • Source: {context.source}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 24 }}>
        <StatCard label="Opponent" value={context.opponent ?? 'N/A'} />
        <StatCard label="Season Avg" value={formatStat(context.season_avg)} />
        <StatCard label="Last 10 Avg" value={formatStat(context.last_10_avg)} />
        <StatCard label="Career Avg" value={formatStat(context.career_avg)} />
        <StatCard label="Home Split" value={formatStat(context.home_split)} />
        <StatCard label="Away Split" value={formatStat(context.away_split)} />
        <StatCard label="Current Line" value={formatStat(context.line)} />
        <StatCard label="Minutes Last 5" value={context.minutes_last_5.length ? context.minutes_last_5.join(', ') : 'N/A'} />
      </div>
      <section style={{ marginTop: 28 }}>
        <h2>Availability</h2>
        <p>Status: {context.injury_context.status}</p>
        <p>Teammates out: {context.injury_context.teammates_out.length ? context.injury_context.teammates_out.join(', ') : 'None returned'}</p>
      </section>
      {context.notes?.length ? (
        <section style={{ marginTop: 28 }}>
          <h2>Notes</h2>
          <ul>{context.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </section>
      ) : null}
      {context.errors?.length ? (
        <section style={{ marginTop: 28, color: '#b00020' }}>
          <h2>Partial Data Warnings</h2>
          <ul>{context.errors.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}
