# Prop Edge NBA Service

FastAPI service that wraps the Python `nba_api` package.

## Local run

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Main endpoints

- `/health`
- `/nba/slate`
- `/nba/players?limit=50`
- `/nba/pick-context?playerSlug=jalen-brunson&market=points`
