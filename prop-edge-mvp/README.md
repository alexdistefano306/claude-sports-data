# Prop Edge MVP

This repository contains a minimal Next.js starter for the sports pick evaluation dashboard.

## Getting started

Ensure you have Node.js installed. Install dependencies and run the development server:

```bash
npm install
npm run dev
```

The app will be available at <http://localhost:3000>.

## API Endpoints

The project includes several API endpoints:

- `GET /api/health` – returns a simple health check with a timestamp.
- `GET /api/slate` – returns the current slate of games.
- `GET /api/players` – returns a list of all sample players.
- `GET /api/pick-context/[sport]/[playerSlug]/[market]` – returns a context payload for a given sport, player and market.
- `GET /api/predictions` – returns all recorded predictions.
- `POST /api/predictions` – accepts a JSON body `{ playerSlug, market, line, confidence }` and records a prediction.
- `GET /api/results` – returns all predictions that have results recorded.
- `POST /api/results` – accepts a JSON body `{ id, result }` to record a result (e.g., `"win"` or `"loss"`).

All of these endpoints use in-memory data structures for demonstration. In a real application, you would integrate a database and data ingestion pipeline.

## Structure

Key files and directories include:

- `lib/data.ts` – sample players and games along with helper functions.
- `lib/predictions.ts` – in-memory storage and functions for handling predictions and results.
- `pages/index.tsx` – home page with links to the API and dashboard.
- `pages/dashboard.tsx` – a simple dashboard listing the slate and players with links to player pages.
- `pages/player/[playerSlug].tsx` – dynamic route that displays pick context for a player.
- `pages/api/health.ts` – health check endpoint.
- `pages/api/slate.ts` – slate endpoint driven by `lib/data.ts`.
- `pages/api/players.ts` – players endpoint.
- `pages/api/predictions.ts` – predictions API for listing and creating predictions.
- `pages/api/results.ts` – results API for listing and updating results.
- `pages/api/pick-context/[sport]/[playerSlug]/[market].ts` – dynamic API route for pick context using `lib/data.ts`.

These files illustrate how to wire up Next.js API routes and pages. You can extend them to integrate a real database, odds ingestion, tracking, and result settlement as described in the project plan.