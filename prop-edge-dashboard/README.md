# Prop Edge Dashboard

Player data dashboard for the Prop Edge Model v3.1. Pulls live NBA Stats API data to support independent projection building.

## What it does

- Search any NBA player by name
- Shows all Tier 1, 2, 3 data points needed for model projections:
  - Season averages + career averages
  - Position-specific usage rate and true shooting %
  - Home/Away splits
  - B2B splits (how much a player declines on zero rest)
  - Last 5 game log with minutes trend
- Built-in projection calculator using the model's weighted formula:
  `(Career × 0.855) + (Season × 0.142) + (Last game × 0.003)`
- Situational multiplier toggles (B2B, blowout risk, teammate out, pace, etc.)
- Live gap % vs book line with BET/NO BET status

## Run locally

```bash
npm install
npm start
```

Opens at `http://localhost:3000`

## Deploy to Render

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Environment:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Port:** `3000` (or leave blank — Render auto-detects PORT env var)
5. Click Deploy

No environment variables required. NBA Stats API is public.

## Data Sources

- [NBA Stats API](https://stats.nba.com) — free, public
- No API key needed
- Data cached for 5 minutes to avoid rate limiting

## Adding NHL / MLB

When ready, add server routes for:
- NHL: NHL Stats API (`api.nhle.com`) for player stats, team shots against
- MLB: MLB Stats API (`statsapi.mlb.com`) for pitcher SwStr%, GB%, opponent K rates

## Folder structure

```
prop-edge-dashboard/
├── server.js          # Express backend — proxies NBA Stats API
├── package.json
├── render.yaml        # Render deployment config
├── public/
│   └── index.html     # Full frontend (single file)
└── README.md
```
