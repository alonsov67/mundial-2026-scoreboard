const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "127.0.0.1";
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000);

const FIFA_MATCHES_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&idCompetition=17&idSeason=285023&count=500";
const FIFA_ARTICLE_URL =
  "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums";
const FIFA_ARTICLE_API_URL =
  "https://cxm-api.fifa.com/fifaplusweb/api/sections/article/S9YG2JmeGYaMUCBbm0CcD?locale=en";

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const CACHE_DIR = path.join(ROOT_DIR, "data", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "fifa-world-cup-2026.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

let memoryCache = null;

function localized(value, fallback = "") {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return fallback;
  const preferred =
    value.find((item) => item.Locale === "en-GB") ||
    value.find((item) => item.Locale && item.Locale.startsWith("en")) ||
    value[0];
  return preferred?.Description || fallback;
}

function toNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeFlagUrl(template) {
  if (!template) return "";
  return template.replace("{format}", "sq").replace("{size}", "4");
}

function normalizeTeam(team, placeholder) {
  if (!team) {
    return {
      id: null,
      name: placeholder || "Pendiente",
      shortName: placeholder || "Pendiente",
      abbreviation: placeholder || "TBD",
      countryCode: null,
      flagUrl: ""
    };
  }

  const name = localized(team.TeamName, team.ShortClubName || placeholder || "Pendiente");
  return {
    id: team.IdTeam || null,
    name,
    shortName: team.ShortClubName || name,
    abbreviation: team.Abbreviation || placeholder || "TBD",
    countryCode: team.IdCountry || team.IdAssociation || null,
    flagUrl: normalizeFlagUrl(team.PictureUrl)
  };
}

function normalizeStatus(match) {
  const hasScore =
    Number.isFinite(match.HomeTeamScore) && Number.isFinite(match.AwayTeamScore);

  if (hasScore && match.MatchStatus === 0) {
    return { code: match.MatchStatus, label: "Finalizado", tone: "final" };
  }
  if (hasScore && match.MatchStatus !== 1) {
    return { code: match.MatchStatus, label: "Con resultado", tone: "final" };
  }
  if (match.MatchStatus === 1) {
    return { code: match.MatchStatus, label: "Programado", tone: "scheduled" };
  }
  if (match.MatchStatus === 3) {
    return { code: match.MatchStatus, label: "En actualizacion FIFA", tone: "live" };
  }
  return {
    code: match.MatchStatus,
    label: `Estado FIFA ${match.MatchStatus ?? "ND"}`,
    tone: "unknown"
  };
}

function normalizeMatch(match) {
  const stage = localized(match.StageName, "ND");
  const group = localized(match.GroupName, "");
  const status = normalizeStatus(match);
  const matchNumber = Number(match.MatchNumber);
  const dateUtc = match.Date || match.LocalDate || null;
  const localDateRaw = match.LocalDate || match.Date || null;
  const home = normalizeTeam(match.Home, match.PlaceHolderA);
  const away = normalizeTeam(match.Away, match.PlaceHolderB);

  return {
    id: match.IdMatch,
    matchNumber: Number.isFinite(matchNumber) ? matchNumber : null,
    dateUtc,
    localDateRaw,
    stage,
    group,
    status,
    home,
    away,
    homeScore: toNumberOrNull(match.HomeTeamScore),
    awayScore: toNumberOrNull(match.AwayTeamScore),
    homePenaltyScore: toNumberOrNull(match.HomeTeamPenaltyScore),
    awayPenaltyScore: toNumberOrNull(match.AwayTeamPenaltyScore),
    winnerTeamId: match.Winner || null,
    attendance: match.Attendance || null,
    venue: localized(match.Stadium?.Name, "ND"),
    city: localized(match.Stadium?.CityName, "ND"),
    countryCode: match.Stadium?.IdCountry || null,
    placeholderHome: match.PlaceHolderA || "",
    placeholderAway: match.PlaceHolderB || "",
    officialUrl: `https://www.fifa.com/en/match-centre/match/${match.IdCompetition}/${match.IdSeason}/${match.IdStage}/${match.IdMatch}`
  };
}

function compareMatches(a, b) {
  const dateA = a.dateUtc ? Date.parse(a.dateUtc) : Number.MAX_SAFE_INTEGER;
  const dateB = b.dateUtc ? Date.parse(b.dateUtc) : Number.MAX_SAFE_INTEGER;
  if (dateA !== dateB) return dateA - dateB;
  return (a.matchNumber || 0) - (b.matchNumber || 0);
}

function buildStandings(matches) {
  const byGroup = new Map();

  for (const match of matches) {
    if (!match.group || match.homeScore === null || match.awayScore === null) continue;
    if (!byGroup.has(match.group)) byGroup.set(match.group, new Map());
    const table = byGroup.get(match.group);

    for (const team of [match.home, match.away]) {
      if (!table.has(team.id || team.abbreviation)) {
        table.set(team.id || team.abbreviation, {
          id: team.id,
          name: team.name,
          abbreviation: team.abbreviation,
          flagUrl: team.flagUrl,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          points: 0
        });
      }
    }

    const home = table.get(match.home.id || match.home.abbreviation);
    const away = table.get(match.away.id || match.away.abbreviation);
    home.played += 1;
    away.played += 1;
    home.gf += match.homeScore;
    home.ga += match.awayScore;
    away.gf += match.awayScore;
    away.ga += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
    .map(([group, table]) => ({
      group,
      teams: [...table.values()].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.name.localeCompare(b.name);
      })
    }));
}

function summarize(matches) {
  const completed = matches.filter((match) => match.homeScore !== null && match.awayScore !== null);
  const upcoming = matches.filter((match) => match.homeScore === null || match.awayScore === null);
  const live = matches.filter((match) => match.status.tone === "live");
  const next = upcoming
    .filter((match) => match.dateUtc && Date.parse(match.dateUtc) >= Date.now() - 6 * 60 * 60 * 1000)
    .sort(compareMatches)[0] || upcoming.sort(compareMatches)[0] || null;

  return {
    total: matches.length,
    completed: completed.length,
    upcoming: upcoming.length,
    live: live.length,
    nextMatch: next
      ? {
          id: next.id,
          matchNumber: next.matchNumber,
          dateUtc: next.dateUtc,
          home: next.home,
          away: next.away,
          stage: next.stage,
          group: next.group,
          venue: next.venue,
          city: next.city
        }
      : null
  };
}

function buildPayload(raw, fetchedAt, fromCache) {
  const rawMatches = Array.isArray(raw.Results) ? raw.Results : [];
  const matches = rawMatches.map(normalizeMatch).sort(compareMatches);

  return {
    tournament: {
      name: "FIFA World Cup 2026",
      competitionId: "17",
      seasonId: "285023"
    },
    source: {
      endpoint: FIFA_MATCHES_URL,
      article: FIFA_ARTICLE_URL,
      articleApi: FIFA_ARTICLE_API_URL,
      fetchedAt,
      fromCache,
      note:
        "Datos normalizados desde endpoints oficiales FIFA. El endpoint api.fifa.com no esta documentado publicamente; si FIFA cambia el contrato, la app muestra error y conserva cache local."
    },
    summary: summarize(matches),
    standings: buildStandings(matches),
    matches
  };
}

async function readDiskCache() {
  try {
    const text = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeDiskCache(payload) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

async function fetchOfficialMatches() {
  const response = await fetch(FIFA_MATCHES_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "mundial-2026-scoreboard/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`FIFA respondio ${response.status} ${response.statusText}`);
  }

  const raw = await response.json();
  if (!raw || !Array.isArray(raw.Results)) {
    throw new Error("Respuesta FIFA sin Results[]");
  }

  return raw;
}

async function getData(force = false) {
  const now = Date.now();
  if (!force && memoryCache && now - Date.parse(memoryCache.source.fetchedAt) < CACHE_TTL_MS) {
    return { ...memoryCache, source: { ...memoryCache.source, fromCache: true } };
  }

  const diskCache = await readDiskCache();
  if (
    !force &&
    diskCache?.source?.fetchedAt &&
    now - Date.parse(diskCache.source.fetchedAt) < CACHE_TTL_MS
  ) {
    memoryCache = diskCache;
    return { ...diskCache, source: { ...diskCache.source, fromCache: true } };
  }

  try {
    const raw = await fetchOfficialMatches();
    const payload = buildPayload(raw, new Date().toISOString(), false);
    memoryCache = payload;
    await writeDiskCache(payload);
    return payload;
  } catch (error) {
    if (diskCache) {
      return {
        ...diskCache,
        source: {
          ...diskCache.source,
          fromCache: true,
          warning: `No se pudo refrescar FIFA: ${error.message}`
        }
      };
    }
    throw error;
  }
}

async function serveApi(req, res, url) {
  try {
    const force = url.searchParams.get("refresh") === "1";
    const payload = await getData(force);
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 502, {
      error: "No se pudo obtener informacion oficial de FIFA",
      detail: error.message,
      source: FIFA_MATCHES_URL
    });
  }
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(data);
  } catch {
    sendText(res, 404, "Not found");
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendText(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === "/api/matches") {
    await serveApi(req, res, url);
    return;
  }

  await serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`Mundial 2026 scoreboard: http://${HOST}:${PORT}`);
});
