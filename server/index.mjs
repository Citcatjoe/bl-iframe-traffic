/**
 * API du prototype. La clé OTD reste ici ; le navigateur ne parle qu'à ce serveur.
 *   GET /api/now[?point=gothard]               état des traversées alpines (dernier relevé)
 *   GET /api/history?point=gothard&hours=24    séries d'une traversée
 *   GET /api/messages[?all=1]                  messages bruts parsés des traversées (ou tout le flux) — debug
 */
import express from "express";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CROSSINGS, CROSSING_BY_ID, crossingRefs, summarizeCrossing } from "../lib/crossings.mjs";
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
// Au-delà, les mesures compteurs ne sont plus affichées comme « actuelles ».
const COUNTERS_MAX_AGE_MS = 15 * 60_000;

const store = openStore(`${DATA_DIR}/archive.sqlite`);

// Derniers relevés gardés en mémoire (et sur disque / en base) : /api/now répond sans rappeler l'API après un redémarrage.
// Un latest.json écrit par une version antérieure du parseur (sans `condition`) est ignoré jusqu'au prochain relevé.
let latest = existsSync(LATEST_PATH) ? JSON.parse(await readFile(LATEST_PATH, "utf8")) : null;
if (latest && latest.situations.length && !("condition" in latest.situations[0])) latest = null;
let latestCounters = store.latestCounters();

const poller = startPoller({
  apiKey: process.env.OTD_API_KEY,
  countersApiKey: process.env.OTD_COUNTERS_API_KEY || process.env.OTD_API_KEY,
  store,
  intervalMs: INTERVAL_MIN * 60_000,
  onSituations: async (snapshot) => {
    latest = snapshot;
    await writeFile(LATEST_PATH, JSON.stringify(snapshot));
  },
  onCounters: (measured) => {
    latestCounters = measured;
  },
});

const app = express();

function crossingsParam(req, res) {
  const id = req.query.point;
  if (id == null) return CROSSINGS;
  if (CROSSING_BY_ID[id]) return [CROSSING_BY_ID[id]];
  res.status(404).json({ error: { code: "UNKNOWN_POINT", message: `Traversée inconnue : ${id}. Valeurs : ${CROSSINGS.map((c) => c.id).join(", ")}` } });
  return null;
}

function notReady(res) {
  return res.status(503).json({
    error: poller.state.situations.last_error ?? { code: "PENDING", message: "Premier relevé en cours…" },
    poller: poller.state,
    source: SOURCE,
  });
}

app.get("/api/now", (req, res) => {
  const selected = crossingsParam(req, res);
  if (!selected) return;
  if (!latest) return notReady(res);
  const now = new Date().toISOString();
  const countersFresh = latestCounters && Date.now() - Date.parse(latestCounters.fetched_at) <= COUNTERS_MAX_AGE_MS;
  const detectors = countersFresh ? latestCounters.detectors : null;
  res.json({
    source: SOURCE,
    fetched_at: latest.fetched_at,
    publication_time: latest.publication_time,
    counters_at: countersFresh ? latestCounters.fetched_at : null,
    poller: poller.state,
    crossings: selected.map((c) => summarizeCrossing(c, latest.situations, now, detectors)),
  });
});

app.get("/api/history", (req, res) => {
  const id = req.query.point;
  if (!CROSSING_BY_ID[id]) {
    return res.status(400).json({ error: { code: "UNKNOWN_POINT", message: `Paramètre point requis : ${CROSSINGS.map((c) => c.id).join(", ")}` } });
  }
  const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  res.json({ source: SOURCE, point: id, hours, since, ...store.history(id, since) });
});

app.get("/api/messages", (req, res) => {
  if (!latest) return notReady(res);
  const all = req.query.all === "1";
  const situations = latest.situations
    .map((s) => ({ ...s, crossings: crossingRefs(s) }))
    .filter((s) => all || s.crossings.length);
  res.json({ source: SOURCE, fetched_at: latest.fetched_at, total: latest.situations.length, situations });
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
