from __future__ import annotations

from datetime import datetime, timezone
from statistics import mean
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from nba_api.live.nba.endpoints import scoreboard
from nba_api.stats.endpoints import commonplayerinfo, playercareerstats, playergamelog
from nba_api.stats.static import players as static_players
from zoneinfo import ZoneInfo

app = FastAPI(title="Prop Edge NBA Service", version="1.0.0")

NBA_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.nba.com",
    "Referer": "https://www.nba.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
}

MARKET_COLUMN_MAP = {
    "points": "PTS",
    "rebounds": "REB",
    "assists": "AST",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_eastern_string() -> str:
    return datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")


def season_string(reference: datetime | None = None) -> str:
    reference = reference or datetime.now(ZoneInfo("America/New_York"))
    year = reference.year
    if reference.month < 10:
        year -= 1
    return f"{year}-{str((year + 1) % 100).zfill(2)}"


def slugify(name: str) -> str:
    return "-".join(
        part for part in "".join(char.lower() if char.isalnum() else " " for char in name).split() if part
    )


def average(values: list[float]) -> float | None:
    valid = [value for value in values if isinstance(value, (int, float))]
    if not valid:
        return None
    return round(mean(valid), 1)


def parse_minutes(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return round(float(value), 1)
    if not isinstance(value, str) or not value:
        return None
    if ":" not in value:
        try:
            return round(float(value), 1)
        except ValueError:
            return None
    minutes, seconds = value.split(":", 1)
    try:
        return round(int(minutes) + int(seconds) / 60, 1)
    except ValueError:
        return None


def result_sets_to_map(payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    sets = payload.get("resultSets")
    if isinstance(sets, dict):
        sets = [sets]
    if not isinstance(sets, list):
        single = payload.get("resultSet")
        if isinstance(single, dict):
            sets = [single]
        else:
            sets = []

    output: dict[str, list[dict[str, Any]]] = {}
    for result_set in sets:
        headers = result_set.get("headers") or []
        rows = result_set.get("rowSet") or []
        name = result_set.get("name") or result_set.get("resource") or "ResultSet"
        mapped_rows: list[dict[str, Any]] = []
        if isinstance(headers, list) and isinstance(rows, list):
            for row in rows:
                if isinstance(row, list):
                    mapped_rows.append({headers[index]: row[index] if index < len(row) else None for index in range(len(headers))})
        output[str(name)] = mapped_rows
    return output


def get_active_player_directory() -> list[dict[str, Any]]:
    active_players = static_players.get_active_players()
    return [
        {
            "playerId": player["id"],
            "slug": slugify(player["full_name"]),
            "name": player["full_name"],
            "team": "",
            "position": "",
            "source": "nba_api_static",
        }
        for player in active_players
    ]


def find_player(player_slug: str) -> dict[str, Any] | None:
    normalized_slug = slugify(player_slug.replace("-", " "))
    active_players = static_players.get_active_players()
    for player in active_players:
        if slugify(player["full_name"]) == normalized_slug:
            return player
    return None


def get_live_scoreboard() -> dict[str, Any]:
    board = scoreboard.ScoreBoard()
    return board.get_dict()


def parse_live_games(scoreboard_payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_games = scoreboard_payload.get("scoreboard", {}).get("games", [])
    games: list[dict[str, Any]] = []
    for game in raw_games:
        home_team = game.get("homeTeam", {})
        away_team = game.get("awayTeam", {})
        games.append(
            {
                "id": str(game.get("gameId", "")),
                "sport": "NBA",
                "homeTeam": home_team.get("teamTricode") or home_team.get("teamName") or "HOME",
                "awayTeam": away_team.get("teamTricode") or away_team.get("teamName") or "AWAY",
                "homeTeamId": home_team.get("teamId"),
                "awayTeamId": away_team.get("teamId"),
                "startTime": game.get("gameEt") or game.get("gameTimeUTC") or now_iso(),
                "status": game.get("gameStatusText") or "Scheduled",
                "source": "nba_api_live",
            }
        )
    return games


def extract_player_info(player_id: int, errors: list[str]) -> tuple[str, str]:
    try:
        payload = commonplayerinfo.CommonPlayerInfo(
            player_id=player_id,
            headers=NBA_HEADERS,
            timeout=12,
        ).get_dict()
        result_map = result_sets_to_map(payload)
        rows = result_map.get("CommonPlayerInfo", [])
        if rows:
            row = rows[0]
            team = str(row.get("TEAM_ABBREVIATION") or row.get("TEAM_NAME") or "")
            position = str(row.get("POSITION") or "")
            return team, position
    except Exception as exc:  # noqa: BLE001
        errors.append(f"CommonPlayerInfo failed: {exc}")
    return "", ""


def extract_game_log_stats(player_id: int, market: str, season: str, errors: list[str]) -> tuple[float | None, float | None, float | None, float | None, list[float]]:
    try:
        payload = playergamelog.PlayerGameLog(
            player_id=player_id,
            season=season,
            headers=NBA_HEADERS,
            timeout=30,
        ).get_dict()
        result_map = result_sets_to_map(payload)
        rows = next(iter(result_map.values()), [])
        stat_column = MARKET_COLUMN_MAP.get(market.lower(), "PTS")
        stat_values: list[float] = []
        home_values: list[float] = []
        away_values: list[float] = []
        minute_values: list[float] = []
        for row in rows:
            value = row.get(stat_column)
            if isinstance(value, (int, float)):
                stat_values.append(float(value))
                matchup = str(row.get("MATCHUP") or "")
                if "vs." in matchup:
                    home_values.append(float(value))
                if "@" in matchup:
                    away_values.append(float(value))
            minute_value = parse_minutes(row.get("MIN"))
            if minute_value is not None:
                minute_values.append(minute_value)

        return (
            average(stat_values),
            average(stat_values[:10]),
            average(home_values),
            average(away_values),
            minute_values[:5],
        )
    except Exception as exc:  # noqa: BLE001
        errors.append(f"PlayerGameLog failed: {exc}")
        return None, None, None, None, []


def extract_career_average(player_id: int, market: str, errors: list[str]) -> float | None:
    try:
        payload = playercareerstats.PlayerCareerStats(
            player_id=player_id,
            headers=NBA_HEADERS,
            timeout=30,
        ).get_dict()
        result_map = result_sets_to_map(payload)
        rows = result_map.get("SeasonTotalsRegularSeason", []) or result_map.get("CareerTotalsRegularSeason", [])
        stat_column = MARKET_COLUMN_MAP.get(market.lower(), "PTS")
        totals = 0.0
        games_played = 0.0
        for row in rows:
            gp = row.get("GP")
            stat_value = row.get(stat_column)
            if isinstance(gp, (int, float)) and isinstance(stat_value, (int, float)):
                totals += float(stat_value)
                games_played += float(gp)
        if games_played > 0:
            return round(totals / games_played, 1)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"PlayerCareerStats failed: {exc}")
    return None


def find_opponent(team: str, live_games: list[dict[str, Any]]) -> tuple[str | None, int | None]:
    for game in live_games:
        if game["homeTeam"] == team:
            return game["awayTeam"], 1
        if game["awayTeam"] == team:
            return game["homeTeam"], 1
    return None, None


@app.get("/health")
def health() -> dict[str, Any]:
    payload: dict[str, Any] = {
        "status": "ok",
        "service": "prop-edge-nba-service",
        "package": "nba_api",
        "timestamp": now_iso(),
    }
    try:
        live_board = get_live_scoreboard()
        payload["liveScoreboardDate"] = live_board.get("scoreboard", {}).get("gameDate")
        payload["liveGamesCount"] = len(live_board.get("scoreboard", {}).get("games", []))
    except Exception as exc:  # noqa: BLE001
        payload["status"] = "degraded"
        payload["errors"] = [str(exc)]
    return payload


@app.get("/nba/slate")
def nba_slate(date: str | None = Query(default=None)) -> dict[str, Any]:
    errors: list[str] = []
    notes: list[str] = []
    requested_date = date or today_eastern_string()

    try:
        live_payload = get_live_scoreboard()
        actual_date = live_payload.get("scoreboard", {}).get("gameDate") or today_eastern_string()
        games = parse_live_games(live_payload)
        if date and date != actual_date:
            notes.append(
                "nba_api live scoreboard only exposes today's board. The actual date in the response may differ from the requested date."
            )
        return {
            "sport": "NBA",
            "requestedDate": requested_date,
            "actualDate": actual_date,
            "games": games,
            "source": "nba_api_live",
            "errors": errors,
            "notes": notes,
            "updatedAt": now_iso(),
        }
    except Exception as exc:  # noqa: BLE001
        errors.append(str(exc))
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Unable to load the live NBA scoreboard through nba_api.",
                "errors": errors,
                "notes": notes,
            },
        ) from exc


@app.get("/nba/players")
def nba_players(limit: int = Query(default=100, ge=1, le=500), q: str | None = Query(default=None)) -> dict[str, Any]:
    notes: list[str] = [
        "The player directory comes from nba_api static active players. Team and position are populated on the player detail endpoint."
    ]
    errors: list[str] = []
    try:
        directory = get_active_player_directory()
        if q:
            needle = q.strip().lower()
            directory = [player for player in directory if needle in player["name"].lower()]
        return {
            "players": directory[:limit],
            "source": "nba_api_static",
            "errors": errors,
            "notes": notes,
            "updatedAt": now_iso(),
        }
    except Exception as exc:  # noqa: BLE001
        errors.append(str(exc))
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Unable to load active players from nba_api.",
                "errors": errors,
                "notes": notes,
            },
        ) from exc


@app.get("/nba/pick-context")
def pick_context(
    playerSlug: str = Query(...),
    market: str = Query(default="points"),
    line: float | None = Query(default=None),
) -> dict[str, Any]:
    errors: list[str] = []
    notes: list[str] = []

    player = find_player(playerSlug)
    if not player:
        raise HTTPException(
            status_code=404,
            detail={"error": f"Player '{playerSlug}' was not found in nba_api active players."},
        )

    player_id = int(player["id"])
    season = season_string()

    # Required stats source
    season_avg, last_10_avg, home_split, away_split, minutes_last_5 = extract_game_log_stats(
        player_id, market, season, errors
    )

    # Optional enrichments
    team, position = "", ""
    career_avg = None

    try:
        team, position = extract_player_info(player_id, errors)
    except Exception as exc:
        errors.append(f"Optional CommonPlayerInfo failed: {exc}")

    try:
        career_avg = extract_career_average(player_id, market, errors)
    except Exception as exc:
        errors.append(f"Optional PlayerCareerStats failed: {exc}")

    opponent: str | None = None
    rest_days: int | None = None
    try:
        live_games = parse_live_games(get_live_scoreboard())
        opponent, rest_days = find_opponent(team, live_games)
    except Exception as exc:
        errors.append(f"Live scoreboard lookup failed: {exc}")

    if season_avg is None:
        notes.append("PlayerGameLog did not return usable stat rows for this player/season/market.")

    return {
        "player": player["full_name"],
        "playerId": player_id,
        "sport": "NBA",
        "market": market.lower(),
        "line": line,
        "team": team,
        "opponent": opponent,
        "position": position,
        "season_avg": season_avg,
        "career_avg": career_avg,
        "last_10_avg": last_10_avg,
        "home_split": home_split,
        "away_split": away_split,
        "minutes_last_5": minutes_last_5,
        "injury_context": {
            "teammates_out": [],
            "status": "Active",
        },
        "game_context": {
            "spread": None,
            "total": None,
            "rest_days": rest_days,
        },
        "source_timestamps": {
            "odds_updated_at": now_iso(),
            "stats_updated_at": now_iso(),
        },
        "source": "nba_api",
        "errors": errors,
        "notes": notes,
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):  # type: ignore[override]
    detail = exc.detail
    if isinstance(detail, dict):
        return JSONResponse(status_code=exc.status_code, content=detail)
    return JSONResponse(status_code=exc.status_code, content={"error": str(detail)})
