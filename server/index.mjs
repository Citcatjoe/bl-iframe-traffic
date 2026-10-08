/**
 * API du prototype. La clé OTD reste ici ; le navigateur ne parle qu'à ce serveur.
 *   GET /api/now            messages Gothard du dernier relevé + résumé par sens
 *   GET /api/now?all=1      tout le flux (debug)
 *   GET /api/history?hours=24
 */
import express from "express";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gothardSummary } from "../lib/datex.mjs";
import { openStore } from "./store.mjs";
import { startPoller } from "./poller.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
// Chargé ici plutôt que via `node --env-file` : combiné à --watch, ce dernier relance le serveur
// à chaque écriture SQLite dans data/ (macOS).
if (existsSync(`${root}.env`)) process.loadEnvFile(`${root}.env`);
const PORT = Number(process.env.PORT) || 8787;
const DATA_DIR = process.env.DATA_DIR || `${root}data`;
const INTERVAL_MIN = Number(process.env.POLL_INTERVAL_MIN) || 3;
const LATEST_PATH = `${DATA_DIR}/latest.json`;
const SOURCE = "OFROU / opentransportdata.swiss";

const store = openStore(`${DATA_DIR}/archive.sqlite`);

// Dernier relevé gardé en mémoire et sur disque : /api/now répond sans rappeler l'API après un redémarrage.
let latest = existsSync(LATEST_PATH) ? JSON.parse(await readFile(LATEST_PATH, "utf8")) : null;

const poller = startPoller({
  apiKey: process.env.OTD_API_KEY,
  store,
  intervalMs: INTERVAL_MIN * 60_000,
  onSnapshot: async (snapshot) => {
    latest = snapshot;
    await writeFile(LATEST_PATH, JSON.stringify(snapshot));
  },
});

const app = express();

app.get("/api/now", (req, res) => {
  if (!latest) {
    return res.status(503).json({
      error: poller.state.last_error ?? { code: "PENDING", message: "Premier relevé en cours…" },
      poller: poller.state,
      source: SOURCE,
    });
  }
  const all = req.query.all === "1";
  const gothard = latest.situations.filter((s) => s.is_gothard);
  res.json({
    source: SOURCE,
    fetched_at: latest.fetched_at,
    publication_time: latest.publication_time,
    poller: poller.state,
    counts: { total: latest.situations.length, gothard: gothard.length },
    summary: gothardSummary(latest.situations, new Date().toISOString()),
    situations: all ? latest.situations : gothard,
  });
});

app.get("/api/history", (req, res) => {
  const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  res.json({ source: SOURCE, hours, since, series: store.history(since) });
});

// `npm start` après `npm run build` : sert aussi le front.
if (existsSync(`${root}dist`)) app.use(express.static(`${root}dist`));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL", message: err.message } });
});

const server = app.listen(PORT, () => console.log(`[api] http://localhost:${PORT}`));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.once(sig, () => {
    poller.stop();
    server.close();
    store.close();
    process.exit(0);
  });
}
