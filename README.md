# Mundial de Futbol 2026 Scoreboard

Version: 1.5.0

Aplicacion para consultar el calendario y resultados del Mundial 2026 desde fuentes oficiales FIFA y visualizarlos en formato scoreboard.

V1.5 queda lista para GitHub Pages con repositorio publico en GitHub Free. El repositorio queda visible para lectura, clonacion y descarga; solo el propietario o colaboradores agregados explicitamente pueden escribir en el repositorio original.

Licencia: MIT.

## Ejecutar

```powershell
npm start
```

Si `node` no esta en el PATH, en esta maquina tambien puedes ejecutar:

```powershell
& "C:\Users\alonsov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

Luego abre `http://127.0.0.1:5173`.

## Generar version estatica para GitHub Pages

```powershell
npm run export:static
```

Ese comando genera:

```text
public/data/fifa-world-cup-2026.json
```

La app publicada en GitHub Pages usa ese snapshot estatico. El workflow de GitHub Actions lo refresca en cada push a `main`, manualmente con `workflow_dispatch` y cada 30 minutos durante la programacion activa.

## Publicar con GitHub Free

Factibilidad:

- GitHub Pages es hosting estatico para HTML, CSS y JavaScript.
- En GitHub Free, Pages esta disponible para repositorios publicos.
- Con un repositorio publico no se puede impedir que terceros lo clonen, descarguen o hagan fork.
- Terceros no pueden hacer push al repositorio original salvo que sean agregados como colaboradores con permisos.
- MIT permite reutilizacion del codigo bajo los terminos del archivo `LICENSE`.

Pasos:

1. Crear un repositorio publico en GitHub.
2. No agregar colaboradores externos.
3. Subir este proyecto al repositorio.
4. Ir a `Settings > General > Features` y desactivar `Issues`, `Discussions`, `Projects`, `Wiki` y `Pull requests` si la opcion aparece.
5. Ir a `Settings > Pages`.
6. En `Build and deployment`, seleccionar `Source: GitHub Actions`.
7. Ejecutar el workflow `Deploy GitHub Pages` o hacer push a `main`.
8. Abrir la URL publicada: `https://alonsov67.github.io/mundial-2026-scoreboard/`.

Comandos de subida, una vez creado el repo publico en GitHub:

```powershell
git remote add origin https://github.com/alonsov67/mundial-2026-scoreboard.git
git push -u origin main
```

Si `origin` ya existe:

```powershell
git remote set-url origin https://github.com/alonsov67/mundial-2026-scoreboard.git
git push -u origin main
```

Workflow incluido:

```text
.github/workflows/deploy-pages.yml
```

Guia de solo lectura:

```text
docs/GITHUB_PUBLIC_READ_ONLY.md
```

## Fuente de datos

- Endpoint oficial usado por la app: `https://api.fifa.com/api/v3/calendar/matches?language=en&idCompetition=17&idSeason=285023&count=500`
- Articulo oficial de referencia: `https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums`

El servidor local consulta FIFA al cargar `/api/matches`, normaliza 104 partidos, calcula tablas de grupos con resultados disponibles y guarda una cache local en `data/cache/fifa-world-cup-2026.json`.

En GitHub Pages, la app no ejecuta Node.js: lee `public/data/fifa-world-cup-2026.json`, generado por GitHub Actions.

## Riesgos y controles

- El endpoint `api.fifa.com` es oficial pero no esta documentado publicamente como contrato estable. Si FIFA cambia la estructura, la app conserva la cache local y muestra advertencia.
- El servidor no recibe credenciales ni persiste datos personales.
- La vista de grupos calcula posiciones con puntos, diferencia de gol y goles a favor; no implementa todos los criterios reglamentarios de desempate FIFA.
- La version Pages es un snapshot. Puede quedar desactualizada si GitHub Actions falla, si FIFA cambia el endpoint o si se agotan limites operativos de Actions.
