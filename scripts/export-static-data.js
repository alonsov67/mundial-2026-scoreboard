const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "public", "data", "fifa-world-cup-2026.json");
const PORT = process.env.EXPORT_PORT || "5180";
const API_URL = `http://127.0.0.1:${PORT}/api/matches?refresh=1`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, attempts = 30) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 240)}`);
      }
      return body;
    } catch (error) {
      lastError = error;
      await wait(1000);
    }
  }
  throw lastError;
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], {
    cwd: ROOT_DIR,
    env: { ...process.env, PORT },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const logs = [];
  server.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  server.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  try {
    const body = await fetchWithRetry(API_URL);
    const payload = JSON.parse(body);
    payload.source = {
      ...payload.source,
      publicationMode: "static",
      exportedAt: new Date().toISOString()
    };

    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Exportado snapshot estatico: ${OUTPUT_FILE}`);
    console.log(`Partidos: ${payload.summary?.total ?? "ND"}`);
  } catch (error) {
    console.error(logs.join(""));
    throw error;
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
