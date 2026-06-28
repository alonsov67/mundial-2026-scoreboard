# V1.5 - Publicacion en GitHub Pages

## Decision

La V1.5 separa dos modos de ejecucion:

- Local: `server.js` consulta FIFA en vivo y sirve `/api/matches`.
- GitHub Pages: `public/app.js` lee `public/data/fifa-world-cup-2026.json`.

Esto evita depender de un backend en GitHub Pages, porque Pages solo sirve archivos estaticos.

## Repositorio privado con app publica

Se puede si el plan de GitHub permite Pages desde repositorios privados. El sitio publicado por Pages queda abierto en internet aunque el repositorio sea privado.

Implicacion: todo lo que quede dentro de `public/` debe tratarse como publico.

## Flujo de despliegue

1. `npm run check`
2. `npm run export:static`
3. GitHub Actions sube `public/` como artifact de Pages.
4. `actions/deploy-pages` publica el sitio.

Archivo:

```text
.github/workflows/deploy-pages.yml
```

Repositorio objetivo:

```text
https://github.com/alonsov67/mundial-2026-scoreboard
```

URL esperada de la app:

```text
https://alonsov67.github.io/mundial-2026-scoreboard/
```

## Fuente oficial

Endpoint:

```text
https://api.fifa.com/api/v3/calendar/matches?language=en&idCompetition=17&idSeason=285023&count=500
```

Articulo oficial de control:

```text
https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums
```

## Riesgos

- El endpoint FIFA es oficial, pero no documentado como contrato publico estable.
- GitHub Actions puede retrasarse o fallar.
- El snapshot publicado puede estar desactualizado entre ejecuciones.
- Las tablas de grupos no implementan todos los criterios oficiales de desempate.
