# Prop Edge NBA API Stack

This repo now contains **two services**:

1. **Web app (root)**: Next.js dashboard and JSON routes for Claude or any other client.
2. **NBA service (`/nba-service`)**: FastAPI service powered by `nba_api`.

The official `nba_api` package is a Python client for NBA.com, supports both NBA Official Stats and NBA Live Data, and the project recommends static datasets to reduce repeated player/team lookups. The README shows `scoreboard.ScoreBoard()` for live data and `players.get_active_players()` for a static player directory.

## What changed

- The web app no longer tries to call fragile NBA endpoints directly from Node.
- `/api/slate`, `/api/players`, and `/api/pick-context` now proxy to your own Python service.
- The Python service uses:
  - `nba_api.live.nba.endpoints.scoreboard.ScoreBoard()` for the live slate
  - `nba_api.stats.static.players.get_active_players()` for the player directory
  - `CommonPlayerInfo`, `PlayerGameLog`, and `PlayerCareerStats` for player detail context
- The dashboard now shows upstream notes/errors instead of silently returning empty arrays.

## Deploy order

### 1. Deploy the Python service first
Create a **new Render web service** pointing at the `nba-service` folder.

Service settings:

- **Environment**: Python
- **Root directory**: `nba-service`
- **Build command**:
  ```bash
  pip install -r requirements.txt
  ```
- **Start command**:
  ```bash
  uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

After deployment, copy the service URL.

### 2. Update the existing web service
Your current Render web service should still point at the repo root.

Service settings:

- **Environment**: Node
- **Build command**:
  ```bash
  npm install && npm run build
  ```
- **Start command**:
  ```bash
  npm start
  ```

Set this environment variable on the web service:

```bash
NBA_SERVICE_URL=https://your-python-service.onrender.com
```

Then redeploy the web service.

## Endpoints

### Web app
- `/dashboard`
- `/api/health`
- `/api/slate`
- `/api/players?limit=50`
- `/api/pick-context/nba/jalen-brunson/points`

### Python NBA service
- `/health`
- `/nba/slate`
- `/nba/players?limit=50`
- `/nba/pick-context?playerSlug=jalen-brunson&market=points`

## Notes

- The NBA live scoreboard endpoint exposed by `nba_api` is **today's scoreboard only**. The docs list the live endpoint URL as `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json` and document no parameters.
- The player directory endpoint in this repo uses the `nba_api` static dataset, which is why the player cards on the dashboard do not include team/position until you open a player detail page. The `nba_api` static players docs document `get_active_players()` exactly for this use case.
- I could not run live NBA network calls from this sandbox, so the code is wired for deployment but still needs real-world testing on Render.
