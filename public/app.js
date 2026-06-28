const STAGE_ORDER = [
  "First Stage",
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Play-off for third place",
  "Final"
];

const STAGE_LABELS = {
  "First Stage": "Fase de grupos",
  "Round of 32": "Ronda de 32",
  "Round of 16": "Octavos",
  "Quarter-final": "Cuartos",
  "Semi-final": "Semifinales",
  "Play-off for third place": "Tercer puesto",
  Final: "Final"
};

const BOARD_LANES = [
  { key: "groups", label: "Fase de grupos", stages: ["First Stage"] },
  { key: "round32", label: "Ronda de 32", stages: ["Round of 32"] },
  { key: "round16", label: "Octavos", stages: ["Round of 16"] },
  { key: "quarter", label: "Cuartos", stages: ["Quarter-final"] },
  { key: "semi", label: "Semifinales", stages: ["Semi-final"] },
  { key: "finals", label: "Finales", stages: ["Play-off for third place", "Final"] }
];

const STATIC_DATA_URL = "data/fifa-world-cup-2026.json";
const API_DATA_URL = "/api/matches";

const state = {
  payload: null,
  view: "board",
  search: "",
  stage: "all",
  group: "all"
};

const els = {
  sourceStatus: document.querySelector("#sourceStatus"),
  statTotal: document.querySelector("#statTotal"),
  statDone: document.querySelector("#statDone"),
  statPending: document.querySelector("#statPending"),
  statLive: document.querySelector("#statLive"),
  refreshButton: document.querySelector("#refreshButton"),
  searchInput: document.querySelector("#searchInput"),
  stageFilter: document.querySelector("#stageFilter"),
  groupFilter: document.querySelector("#groupFilter"),
  errorPanel: document.querySelector("#errorPanel"),
  groupsGrid: document.querySelector("#groupsGrid"),
  stageLanes: document.querySelector("#stageLanes"),
  visibleCount: document.querySelector("#visibleCount"),
  calendarList: document.querySelector("#calendarList"),
  endpointLink: document.querySelector("#endpointLink"),
  articleLink: document.querySelector("#articleLink"),
  fetchedAt: document.querySelector("#fetchedAt"),
  sourceNote: document.querySelector("#sourceNote"),
  nextMatch: document.querySelector("#nextMatch")
};

function prefersStaticData() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("static") === "1" ||
    window.location.protocol === "file:" ||
    window.location.hostname.endsWith("github.io")
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value, options = {}) {
  if (!value) return "ND";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: options.timeZone || "America/Bogota",
    weekday: options.weekday || "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: options.withTime === false ? undefined : "2-digit",
    minute: options.withTime === false ? undefined : "2-digit"
  }).format(new Date(value));
}

function formatDay(value) {
  if (!value) return "Fecha ND";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function stageLabel(stage) {
  return STAGE_LABELS[stage] || stage || "ND";
}

function scoreLabel(value) {
  return Number.isFinite(value) ? String(value) : "-";
}

function teamName(team) {
  return team?.name || team?.shortName || team?.abbreviation || "Pendiente";
}

function teamMarkup(team) {
  const flag = team?.flagUrl
    ? `<img class="flag" src="${escapeHtml(team.flagUrl)}" alt="" loading="lazy" />`
    : `<span class="flag" aria-hidden="true"></span>`;
  return `${flag}<span class="team-name">${escapeHtml(teamName(team))}</span>`;
}

function matchSearchText(match) {
  return [
    match.matchNumber,
    match.stage,
    match.group,
    teamName(match.home),
    teamName(match.away),
    match.home?.abbreviation,
    match.away?.abbreviation,
    match.venue,
    match.city,
    match.countryCode,
    match.status?.label
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filteredMatches() {
  if (!state.payload) return [];
  const query = state.search.trim().toLowerCase();
  return state.payload.matches.filter((match) => {
    if (state.stage !== "all" && match.stage !== state.stage) return false;
    if (state.group !== "all" && match.group !== state.group) return false;
    if (query && !matchSearchText(match).includes(query)) return false;
    return true;
  });
}

function compareByDate(a, b) {
  const dateA = a.dateUtc ? Date.parse(a.dateUtc) : Number.MAX_SAFE_INTEGER;
  const dateB = b.dateUtc ? Date.parse(b.dateUtc) : Number.MAX_SAFE_INTEGER;
  if (dateA !== dateB) return dateA - dateB;
  return (a.matchNumber || 0) - (b.matchNumber || 0);
}

function boardMatches() {
  const matches = filteredMatches();
  const defaultBoard = !state.search.trim() && state.stage === "all" && state.group === "all";
  if (!defaultBoard) return matches;

  const groupMatches = matches.filter((match) => match.stage === "First Stage");
  const knockoutMatches = matches.filter((match) => match.stage !== "First Stage");
  const live = groupMatches.filter((match) => match.status?.tone === "live");
  const upcoming = groupMatches
    .filter((match) => match.homeScore === null || match.awayScore === null)
    .sort(compareByDate)
    .slice(0, 6);
  const latestCompleted = groupMatches
    .filter((match) => match.homeScore !== null && match.awayScore !== null)
    .sort((a, b) => compareByDate(b, a))
    .slice(0, 4);

  const featured = new Map();
  [...live, ...upcoming, ...latestCompleted].forEach((match) => featured.set(match.id, match));
  return [...featured.values(), ...knockoutMatches].sort(compareByDate);
}

function renderControls() {
  const matches = state.payload?.matches || [];
  const stages = [...new Set(matches.map((match) => match.stage).filter(Boolean))].sort(
    (a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b)
  );
  const groups = [...new Set(matches.map((match) => match.group).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true })
  );

  els.stageFilter.innerHTML = [
    `<option value="all">Todas las rondas</option>`,
    ...stages.map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(stageLabel(stage))}</option>`)
  ].join("");
  els.stageFilter.value = state.stage;

  els.groupFilter.innerHTML = [
    `<option value="all">Todos los grupos</option>`,
    ...groups.map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`)
  ].join("");
  els.groupFilter.value = state.group;
}

function renderSummary() {
  const summary = state.payload?.summary;
  const source = state.payload?.source;
  if (!summary || !source) return;

  els.statTotal.textContent = summary.total;
  els.statDone.textContent = summary.completed;
  els.statPending.textContent = summary.upcoming;
  els.statLive.textContent = summary.live;

  const cacheLabel =
    source.publicationMode === "static"
      ? "snapshot estatico para GitHub Pages"
      : source.fromCache
        ? "cache local"
        : "FIFA en vivo";
  const fetched = formatDate(source.fetchedAt);
  els.sourceStatus.textContent = `${summary.total} partidos normalizados desde ${cacheLabel}. Ultima consulta: ${fetched}`;
}

function renderGroups() {
  const standings = state.payload?.standings || [];
  if (!standings.length) {
    els.groupsGrid.innerHTML = `<div class="empty-state">No hay tablas de grupo disponibles con resultados.</div>`;
    return;
  }

  els.groupsGrid.innerHTML = standings
    .map((group) => {
      const rows = group.teams
        .map(
          (team, index) => `
            <tr>
              <td>
                <div class="team-cell">
                  <span>${index + 1}</span>
                  ${teamMarkup(team)}
                </div>
              </td>
              <td>${team.played}</td>
              <td>${team.gf}</td>
              <td>${team.ga}</td>
              <td>${team.gd}</td>
              <td><strong>${team.points}</strong></td>
            </tr>
          `
        )
        .join("");

      return `
        <article class="group-card">
          <div class="group-title">
            <span>${escapeHtml(group.group)}</span>
            <small>${group.teams.length} equipos</small>
          </div>
          <table class="standings-table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>PJ</th>
                <th>GF</th>
                <th>GC</th>
                <th>DG</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </article>
      `;
    })
    .join("");
}

function matchCard(match) {
  const statusTone = match.status?.tone || "unknown";
  const statusClass = statusTone === "final" ? "final" : statusTone === "live" ? "live" : "";
  const homeScoreClass = Number.isFinite(match.homeScore) ? "score" : "score pending";
  const awayScoreClass = Number.isFinite(match.awayScore) ? "score" : "score pending";
  const groupOrStage = match.group || stageLabel(match.stage);

  return `
    <article class="match-card ${statusClass}">
      <div class="match-meta">
        <span class="badge ${statusClass}">M${escapeHtml(match.matchNumber || "ND")}</span>
        <span>${escapeHtml(groupOrStage)}</span>
      </div>
      <div class="teams">
        <div class="team-row">
          <strong title="${escapeHtml(teamName(match.home))}">${teamMarkup(match.home)}</strong>
          <span class="${homeScoreClass}">${scoreLabel(match.homeScore)}</span>
        </div>
        <div class="team-row">
          <strong title="${escapeHtml(teamName(match.away))}">${teamMarkup(match.away)}</strong>
          <span class="${awayScoreClass}">${scoreLabel(match.awayScore)}</span>
        </div>
      </div>
      <div class="match-foot">
        <span>${escapeHtml(formatDate(match.dateUtc))}</span>
        <span>${escapeHtml(match.venue)} · ${escapeHtml(match.city)}</span>
        <a href="${escapeHtml(match.officialUrl)}" target="_blank" rel="noreferrer">Ficha FIFA</a>
      </div>
    </article>
  `;
}

function renderBoard() {
  const allFiltered = filteredMatches();
  const matches = boardMatches();
  const defaultBoard = !state.search.trim() && state.stage === "all" && state.group === "all";
  els.visibleCount.textContent = defaultBoard
    ? `${matches.length} destacados en tablero · ${allFiltered.length} total`
    : `${matches.length} partidos visibles`;

  const laneDefs = BOARD_LANES.filter((lane) =>
    matches.some((match) => lane.stages.includes(match.stage))
  );
  const knownLaneStages = new Set(BOARD_LANES.flatMap((lane) => lane.stages));
  const extraLanes = [...new Set(matches.map((match) => match.stage).filter(Boolean))]
    .filter((stage) => !knownLaneStages.has(stage))
    .map((stage) => ({ key: stage, label: stageLabel(stage), stages: [stage] }));
  const allLanes = [...laneDefs, ...extraLanes];

  if (!allLanes.length) {
    els.stageLanes.innerHTML = `<div class="empty-state">No hay partidos para los filtros seleccionados.</div>`;
    return;
  }

  els.stageLanes.innerHTML = allLanes
    .map((lane) => {
      const cards = matches
        .filter((match) => lane.stages.includes(match.stage))
        .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0))
        .map(matchCard)
        .join("");
      return `
        <section class="stage-lane">
          <h3>${escapeHtml(lane.label)}</h3>
          ${cards}
        </section>
      `;
    })
    .join("");
}

function renderCalendar() {
  const matches = filteredMatches();
  if (!matches.length) {
    els.calendarList.innerHTML = `<div class="empty-state">No hay partidos para los filtros seleccionados.</div>`;
    return;
  }

  const byDay = new Map();
  for (const match of matches) {
    const day = formatDay(match.dateUtc);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(match);
  }

  els.calendarList.innerHTML = [...byDay.entries()]
    .map(
      ([day, dayMatches]) => `
        <section class="day-section">
          <h2>${escapeHtml(day)}</h2>
          <div class="day-matches">${dayMatches.map(matchCard).join("")}</div>
        </section>
      `
    )
    .join("");
}

function renderDataView() {
  const source = state.payload?.source;
  const next = state.payload?.summary?.nextMatch;
  if (!source) return;

  els.endpointLink.href = source.endpoint;
  els.endpointLink.textContent = source.endpoint;
  els.articleLink.href = source.article;
  els.articleLink.textContent = source.article;
  els.fetchedAt.textContent = `${formatDate(source.fetchedAt)} (${source.fromCache ? "cache" : "consulta directa"})`;
  els.sourceNote.textContent = source.warning || source.note || "ND";

  if (!next) {
    els.nextMatch.textContent = "ND";
    return;
  }

  els.nextMatch.innerHTML = `
    <article class="match-card">
      <div class="match-meta">
        <span class="badge">M${escapeHtml(next.matchNumber || "ND")}</span>
        <span>${escapeHtml(next.group || stageLabel(next.stage))}</span>
      </div>
      <div class="teams">
        <div class="team-row"><strong>${teamMarkup(next.home)}</strong><span class="score pending">-</span></div>
        <div class="team-row"><strong>${teamMarkup(next.away)}</strong><span class="score pending">-</span></div>
      </div>
      <div class="match-foot">
        <span>${escapeHtml(formatDate(next.dateUtc))}</span>
        <span>${escapeHtml(next.venue)} · ${escapeHtml(next.city)}</span>
      </div>
    </article>
  `;
}

function renderAll() {
  renderSummary();
  renderControls();
  renderGroups();
  renderBoard();
  renderCalendar();
  renderDataView();
}

function setError(message) {
  if (!message) {
    els.errorPanel.classList.add("hidden");
    els.errorPanel.textContent = "";
    return;
  }
  els.errorPanel.textContent = message;
  els.errorPanel.classList.remove("hidden");
}

async function loadData(refresh = false) {
  els.refreshButton.disabled = true;
  els.refreshButton.querySelector("span").textContent = "↻";
  setError("");

  try {
    const payload = await fetchData(refresh);
    state.payload = payload;
    renderAll();
    if (payload.source?.warning) setError(payload.source.warning);
  } catch (error) {
    setError(`No fue posible cargar datos oficiales: ${error.message}`);
  } finally {
    els.refreshButton.disabled = false;
  }
}

async function fetchData(refresh = false) {
  const staticUrl = `${STATIC_DATA_URL}${refresh ? `?t=${Date.now()}` : ""}`;
  const apiUrl = `${API_DATA_URL}${refresh ? "?refresh=1" : ""}`;
  const urls = prefersStaticData() ? [staticUrl] : [apiUrl, staticUrl];
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
      }

      if (url.startsWith(STATIC_DATA_URL)) {
        payload.source = {
          ...payload.source,
          fromCache: true,
          publicationMode: "static",
          warning:
            payload.source?.warning ||
            "Version estatica V1.5: el boton Actualizar recarga el snapshot publicado; la consulta real a FIFA ocurre en GitHub Actions o al ejecutar export:static."
        };
      }

      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No hay fuentes de datos disponibles");
}

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.toggle("active", view.id === `${state.view}View`);
    });
  });
});

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderBoard();
  renderCalendar();
});

els.stageFilter.addEventListener("change", (event) => {
  state.stage = event.target.value;
  renderBoard();
  renderCalendar();
});

els.groupFilter.addEventListener("change", (event) => {
  state.group = event.target.value;
  renderBoard();
  renderCalendar();
});

els.refreshButton.addEventListener("click", () => loadData(true));

loadData();
