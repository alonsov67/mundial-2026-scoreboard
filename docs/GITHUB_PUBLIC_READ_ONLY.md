# Repositorio publico de solo lectura

## Objetivo

Usar GitHub Free con repositorio publico y GitHub Pages, pero sin aceptar aportes externos.

## Lo que si se puede garantizar

- Cualquier persona puede leer, clonar y descargar el repositorio publico.
- Solo el propietario o colaboradores con permiso pueden hacer push al repositorio original.
- Si no agregas colaboradores, terceros no pueden escribir en el repositorio original.
- GitHub permite desactivar Issues y Pull requests desde `Settings > General > Features`.

## Lo que no se puede impedir en un repositorio publico

- Forks.
- Clones.
- Descargas del codigo.
- Reutilizacion permitida por la licencia MIT.

## Configuracion recomendada en GitHub

1. Crear repositorio `Public`.
2. No agregar colaboradores externos.
3. `Settings > General > Features`:
   - Desactivar `Issues`.
   - Desactivar `Discussions`.
   - Desactivar `Projects`.
   - Desactivar `Wiki`.
   - Desactivar `Pull requests` si la opcion aparece; si no, seleccionar `Collaborators only`.
4. `Settings > Pages`:
   - `Source: GitHub Actions`.
5. `Settings > Actions > General`:
   - Mantener Actions habilitado para este repositorio.

## Archivos de apoyo

- `.github/ISSUE_TEMPLATE/config.yml` desactiva issues en blanco.
- `.github/PULL_REQUEST_TEMPLATE.md` advierte que no se aceptan PRs si el control de GitHub aun no fue desactivado.
- `CONTRIBUTING.md` declara el modelo de solo lectura.
