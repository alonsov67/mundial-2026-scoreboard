$ErrorActionPreference = "Stop"

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  & $node.Source server.js
  exit $LASTEXITCODE
}

$bundledNode = "C:\Users\alonsov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (Test-Path $bundledNode) {
  & $bundledNode server.js
  exit $LASTEXITCODE
}

throw "No se encontro Node.js. Instala Node >= 18 o ajusta start.ps1 con la ruta del runtime disponible."
