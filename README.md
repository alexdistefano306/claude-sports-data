# Prop Edge Live NBA MVP

This version replaces the fake games and fake player stats with live server-side lookups.

## Data source order
1. NBA stats endpoints on `stats.nba.com`
2. BALLDONTLIE fallback when the NBA request fails

## Required environment variables
- `BALLDONTLIE_API_KEY` (optional, but needed for fallback)

## Render settings
- Build command: `npm install && npm run build`
- Start command: `npm start`

## Main routes
- `/dashboard`
- `/api/slate`
- `/api/players?limit=80`
- `/api/pick-context/nba/lebron-james/points?line=27.5`
