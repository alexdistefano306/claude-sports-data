const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');
const path = require('path');

const app = express();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── NBA Stats API headers (required to avoid 403) ───────────────────────────
const NBA_HEADERS = {
  'Host': 'stats.nba.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'Connection': 'keep-alive',
};

const SEASON = '2025-26';

// ─── Helper: parse NBA API response into usable object ───────────────────────
function parseNBAResponse(data, setIndex = 0) {
  const resultSet = data.resultSets[setIndex];
  const headers = resultSet.headers;
  return resultSet.rowSet.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

// ─── Helper: NBA API call with caching ───────────────────────────────────────
async function nbaFetch(url, params = {}) {
  const cacheKey = url + JSON.stringify(params);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await axios.get(url, {
    headers: NBA_HEADERS,
    params,
    timeout: 15000,
  });
  cache.set(cacheKey, response.data);
  return response.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Search players by name
app.get('/api/nba/search/:name', async (req, res) => {
  try {
    const data = await nbaFetch('https://stats.nba.com/stats/commonallplayers', {
      LeagueID: '00',
      Season: SEASON,
      IsOnlyCurrentSeason: 1,
    });
    const players = parseNBAResponse(data);
    const query = req.params.name.toLowerCase();
    const results = players
      .filter(p => p.DISPLAY_FIRST_LAST.toLowerCase().includes(query))
      .slice(0, 10)
      .map(p => ({
        id: p.PERSON_ID,
        name: p.DISPLAY_FIRST_LAST,
        team: p.TEAM_ABBREVIATION,
      }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full player card — all data points needed for model
app.get('/api/nba/player/:id', async (req, res) => {
  try {
    const playerId = req.params.id;

    // Fetch in parallel
    const [infoData, gameLogData, splitData, careerData] = await Promise.all([
      nbaFetch('https://stats.nba.com/stats/commonplayerinfo', { PlayerID: playerId }),
      nbaFetch('https://stats.nba.com/stats/playergamelog', {
        PlayerID: playerId,
        Season: SEASON,
        SeasonType: 'Regular Season',
      }),
      nbaFetch('https://stats.nba.com/stats/playerdashboardbygeneralsplits', {
        PlayerID: playerId,
        Season: SEASON,
        SeasonType: 'Regular Season',
        MeasureType: 'Base',
        PerMode: 'PerGame',
        PlusMinus: 'N',
        PaceAdjust: 'N',
        Rank: 'N',
        Outcome: '',
        Location: '',
        Month: 0,
        SeasonSegment: '',
        DateFrom: '',
        DateTo: '',
        OpponentTeamID: 0,
        VsConference: '',
        VsDivision: '',
        GameSegment: '',
        Period: 0,
        ShotClockRange: '',
        LastNGames: 0,
        GameScope: '',
        PlayerExperience: '',
        PlayerPosition: '',
        StarterBench: '',
      }),
      nbaFetch('https://stats.nba.com/stats/playercareerstats', {
        PlayerID: playerId,
        PerMode: 'PerGame',
      }),
    ]);

    const info = parseNBAResponse(infoData)[0];
    const gameLogs = parseNBAResponse(gameLogData);
    const overallSplits = parseNBAResponse(splitData, 0);
    const locationSplits = parseNBAResponse(splitData, 1); // Home/Away
    const restSplits = parseNBAResponse(splitData, 4);     // Rest (B2B, 1 day rest, etc.)

    // Career stats (find most recent complete season + career totals)
    const careerRows = parseNBAResponse(careerData, 0);
    const careerTotals = parseNBAResponse(careerData, 1);

    // Season averages
    const season = overallSplits.find(r => r.GROUP_VALUE === 'Overall') || overallSplits[0] || {};

    // Home/Away splits
    const homeSplit = locationSplits.find(r => r.GROUP_VALUE === 'Home') || {};
    const awaySplit = locationSplits.find(r => r.GROUP_VALUE === 'Road') || {};

    // B2B split
    const b2bSplit = restSplits.find(r => r.GROUP_VALUE === '0 Days Rest') || {};
    const oneRestSplit = restSplits.find(r => r.GROUP_VALUE === '1 Day Rest') || {};

    // Career averages across all seasons (weighted toward recent)
    const careerAvg = careerTotals[0] || {};

    // Last 5 and last 10 game logs
    const last5 = gameLogs.slice(0, 5);
    const last10 = gameLogs.slice(0, 10);

    // Calculate averages from game logs
    function avgFrom(games, stat) {
      if (!games.length) return null;
      const vals = games.map(g => g[stat] || 0);
      return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    }

    // Minutes trend
    const minsTrend = last5.map(g => ({ date: g.GAME_DATE, min: g.MIN, opp: g.MATCHUP }));

    // Build the usage rate approximation from season data
    const usagePct = season.USG_PCT ? (season.USG_PCT * 100).toFixed(1) : null;

    const card = {
      // Identity
      name: info.DISPLAY_FIRST_LAST,
      team: info.TEAM_ABBREVIATION,
      position: info.POSITION,
      status: info.ROSTERSTATUS,
      jerseyNum: info.JERSEY,

      // Season averages (Tier 1)
      season: {
        pts: season.PTS,
        reb: season.REB,
        ast: season.AST,
        min: season.MIN,
        fgPct: season.FG_PCT ? (season.FG_PCT * 100).toFixed(1) : null,
        fg3Pct: season.FG3_PCT ? (season.FG3_PCT * 100).toFixed(1) : null,
        tsPct: season.TS_PCT ? (season.TS_PCT * 100).toFixed(1) : null,
        usgPct: usagePct,
        gp: season.GP,
        blk: season.BLK,
        stl: season.STL,
        tov: season.TOV,
      },

      // Career averages (Tier 1 — primary weight 85.5%)
      career: {
        pts: careerAvg.PTS,
        reb: careerAvg.REB,
        ast: careerAvg.AST,
        min: careerAvg.MIN,
        gp: careerAvg.GP,
      },

      // Home / Away splits (Tier 1)
      home: {
        pts: homeSplit.PTS,
        reb: homeSplit.REB,
        ast: homeSplit.AST,
        min: homeSplit.MIN,
        gp: homeSplit.GP,
      },
      away: {
        pts: awaySplit.PTS,
        reb: awaySplit.REB,
        ast: awaySplit.AST,
        min: awaySplit.MIN,
        gp: awaySplit.GP,
      },

      // B2B splits (Tier 2)
      b2b: {
        pts: b2bSplit.PTS,
        reb: b2bSplit.REB,
        ast: b2bSplit.AST,
        min: b2bSplit.MIN,
        gp: b2bSplit.GP,
        label: '0 Days Rest (B2B)',
      },
      oneRest: {
        pts: oneRestSplit.PTS,
        reb: oneRestSplit.REB,
        ast: oneRestSplit.AST,
        min: oneRestSplit.MIN,
        gp: oneRestSplit.GP,
        label: '1 Day Rest',
      },

      // Last 5 and 10 game averages (flag use only)
      last5: {
        pts: avgFrom(last5, 'PTS'),
        reb: avgFrom(last5, 'REB'),
        ast: avgFrom(last5, 'AST'),
        min: avgFrom(last5, 'MIN'),
        games: last5.map(g => ({
          date: g.GAME_DATE,
          matchup: g.MATCHUP,
          pts: g.PTS,
          reb: g.REB,
          ast: g.AST,
          min: g.MIN,
          fgm: g.FGM,
          fga: g.FGA,
          result: g.WL,
        })),
      },
      last10: {
        pts: avgFrom(last10, 'PTS'),
        reb: avgFrom(last10, 'REB'),
        ast: avgFrom(last10, 'AST'),
        min: avgFrom(last10, 'MIN'),
      },

      // Minutes trend (Tier 2)
      minutesTrend: minsTrend,
    };

    res.json(card);
  } catch (err) {
    console.error('Player card error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Team defense by position (Tier 1 — critical matchup data)
app.get('/api/nba/defense', async (req, res) => {
  try {
    const cacheKey = 'team_defense_' + SEASON;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const data = await nbaFetch('https://stats.nba.com/stats/leaguedashptdefend', {
      Season: SEASON,
      SeasonType: 'Regular Season',
      LeagueID: '00',
      PerMode: 'PerGame',
      DefenseCategory: 'Overall',
    });

    const rows = parseNBAResponse(data);
    cache.set(cacheKey, rows);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Team pace rankings (Tier 1)
app.get('/api/nba/pace', async (req, res) => {
  try {
    const data = await nbaFetch('https://stats.nba.com/stats/leaguedashteamstats', {
      Season: SEASON,
      SeasonType: 'Regular Season',
      MeasureType: 'Advanced',
      PerMode: 'PerGame',
      PlusMinus: 'N',
      PaceAdjust: 'N',
      Rank: 'N',
      Outcome: '',
      Location: '',
      Month: 0,
      SeasonSegment: '',
      DateFrom: '',
      DateTo: '',
      OpponentTeamID: 0,
      VsConference: '',
      VsDivision: '',
      GameScope: '',
      PlayerExperience: '',
      PlayerPosition: '',
      StarterBench: '',
      TwoWay: 0,
    });

    const teams = parseNBAResponse(data);
    const pace = teams
      .map(t => ({ team: t.TEAM_ABBREVIATION, name: t.TEAM_NAME, pace: t.PACE }))
      .sort((a, b) => b.pace - a.pace)
      .map((t, i) => ({ ...t, rank: i + 1 }));

    res.json(pace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Opponent defense vs position (Tier 1 — position-specific matchup)
app.get('/api/nba/opponent-defense/:position', async (req, res) => {
  try {
    const position = req.params.position; // PG, SG, SF, PF, C
    const data = await nbaFetch('https://stats.nba.com/stats/leaguedashptdefend', {
      Season: SEASON,
      SeasonType: 'Regular Season',
      LeagueID: '00',
      PerMode: 'PerGame',
      DefenseCategory: position,
    });
    const rows = parseNBAResponse(data);
    // Sort by points allowed (ascending = best defense)
    const sorted = rows.sort((a, b) => a.FREQ - b.FREQ);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Today's scoreboard (injury context, game totals)
app.get('/api/nba/today', async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric'
    }).replace(/\//g, '%2F');

    const data = await nbaFetch(`https://stats.nba.com/stats/scoreboard`, {
      DayOffset: 0,
      GameDate: today,
      LeagueID: '00',
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Projection Calculator endpoint ──────────────────────────────────────────
// Takes player stats and computes the model projection
app.post('/api/calculate-projection', (req, res) => {
  try {
    const {
      careerAvg,
      seasonAvg,
      lastGameStat,
      situationalMultipliers = [],
    } = req.body;

    if (careerAvg == null || seasonAvg == null) {
      return res.status(400).json({ error: 'careerAvg and seasonAvg are required' });
    }

    // Base projection using model weights
    const lastGame = lastGameStat || seasonAvg; // fallback
    let projection = (careerAvg * 0.855) + (seasonAvg * 0.142) + (lastGame * 0.003);

    // Apply multipliers
    const appliedMultipliers = [];
    for (const mult of situationalMultipliers) {
      const { label, pct } = mult;
      const adjustment = projection * (pct / 100);
      projection += adjustment;
      appliedMultipliers.push({ label, pct, adjustment: adjustment.toFixed(2) });
    }

    res.json({
      baseProjection: ((careerAvg * 0.855) + (seasonAvg * 0.142) + (lastGame * 0.003)).toFixed(2),
      finalProjection: projection.toFixed(2),
      appliedMultipliers,
      formula: `(${careerAvg} × 0.855) + (${seasonAvg} × 0.142) + (${lastGame} × 0.003)`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve frontend ───────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Prop Edge Dashboard running on port ${PORT}`);
});
