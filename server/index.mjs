/**
 * API du prototype, lue par le widget (servi ailleurs, CORS ouvert). La clé OTD reste ici : seul le poller
 * appelle l'API OFROU, quel que soit le nombre de lecteurs.
 *   GET /api/now[?point=gothard]               état des points suivis (dernier relevé)
 *   GET /api/history?point=gothard&hours=24    séries d'un point
 *   GET /api/messages[?all=1]                  messages parsés des points suivis (ou tout le flux) — debug, local
 *                                              seulement : coupé si NODE_ENV=production (VPS)
 */
import express from "express";
import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
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
// Formule imposée par les conditions d'utilisation de l'OFROU (§ 11), voir LICENCES.md.
const SOURCE = "Plateforme de données sur le trafic (PDT) OFROU";
// Conditions OFROU § 8 : pas de données brutes transmises à des tiers par une interface lisible par machine.
// Le flux parsé (debug) ne sort donc jamais du poste de développement.
const DEBUG_ROUTES = process.env.NODE_ENV !== "production";
// Au-delà, les mesures compteurs ne sont plus affichées comme « actuelles ».
const COUNTERS_MAX_AGE_MS = 15 * 60_000;
// Réponses 200 de l'API : réutilisables une minute par les navigateurs et un éventuel CDN ; servies périmées si
// le serveur tombe. Jamais sur les erreurs (503 du premier relevé compris).
const API_CACHE_CONTROL = "public, max-age=60, s-maxage=60, stale-while-revalidate=120, stale-if-error=86400";

const store = openStore(`${DATA_DIR}/archive.sqlite`);

// Derniers relevés gardés en mémoire (et sur disque / en base) : /api/now répond sans rappeler l'API après un redémarrage.
// Un latest.json illisible, ou écrit par une version antérieure du parseur (sans `condition`), est ignoré jusqu'au
// prochain relevé.
let latest = null;
if (existsSync(LATEST_PATH)) {
  try {
    latest = JSON.parse(await readFile(LATEST_PATH, "utf8"));
  } catch (e) {
    console.warn(`[latest] ${LATEST_PATH} ignoré : ${e.message}`);
  }
}
if (latest && latest.situations.length && !("condition" in latest.situations[0])) latest = null;
// Fenêtre des mesures compteurs, recalculée une fois par relevé (et non à chaque requête).
let counters = store.counterWindow();

const poller = startPoller({
  apiKey: process.env.OTD_API_KEY,
  countersApiKey: process.env.OTD_COUNTERS_API_KEY || process.env.OTD_API_KEY,
  store,
  intervalMs: INTERVAL_MIN * 60_000,
  onSituations: async (snapshot) => {
    latest = snapshot;
    // Écrit à côté puis renommé : un arrêt pendant l'écriture ne laisse jamais un latest.json tronqué.
    await writeFile(`${LATEST_PATH}.tmp`, JSON.stringify(snapshot));
    await rename(`${LATEST_PATH}.tmp`, LATEST_PATH);
  },
  onCounters: () => {
    counters = store.counterWindow();
  },
});

const app = express();

// Le widget est servi par un autre hôte (FTP de l'entreprise) : données publiques, lecture seule.
app.use("/api", (_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  next();
});

// Réponses calculées au plus une fois par minute et par relevé, quelle que soit l'audience. La minute fait partie
// de la clé : l'état des fermetures récurrentes et la fraîcheur des compteurs dépendent de l'heure.
let memo = { stamp: null, bodies: new Map() };
function sendMemoized(res, key, compute) {
  const stamp = `${Math.floor(Date.now() / 60_000)}|${latest?.fetched_at}|${counters?.fetched_at}`;
  if (memo.stamp !== stamp) memo = { stamp, bodies: new Map() };
  let body = memo.bodies.get(key);
  if (body === undefined) {
    body = JSON.stringify(compute());
    memo.bodies.set(key, body);
  }
  res.set("Cache-Control", API_CACHE_CONTROL).type("json").send(body);
}

function crossingsParam(req, res) {
  const id = req.query.point;
  if (id == null) return CROSSINGS;
  if (CROSSING_BY_ID[id]) return [CROSSING_BY_ID[id]];
  res.status(404).json({ error: { code: "UNKNOWN_POINT", message: `Point inconnu : ${id}. Valeurs : ${CROSSINGS.map((c) => c.id).join(", ")}` } });
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
  sendMemoized(res, `now|${req.query.point ?? ""}`, () => {
    const now = new Date().toISOString();
    const countersFresh = counters && Date.now() - Date.parse(counters.fetched_at) <= COUNTERS_MAX_AGE_MS;
    return {
      source: SOURCE,
      fetched_at: latest.fetched_at,
      publication_time: latest.publication_time,
      counters_at: countersFresh ? counters.fetched_at : null,
      poller: poller.state,
      crossings: selected.map((c) => summarizeCrossing(c, latest.situations, now, countersFresh ? counters : null)),
    };
  });
});

app.get("/api/history", (req, res) => {
  const id = req.query.point;
  if (!CROSSING_BY_ID[id]) {
    return res.status(400).json({ error: { code: "UNKNOWN_POINT", message: `Paramètre point requis : ${CROSSINGS.map((c) => c.id).join(", ")}` } });
  }
  const hours = Math.min(168, Math.max(1, Math.round(Number(req.query.hours)) || 24));
  sendMemoized(res, `history|${id}|${hours}`, () => {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    return { source: SOURCE, point: id, hours, since, ...store.history(id, since) };
  });
});

app.get("/api/messages", (req, res) => {
  if (!DEBUG_ROUTES) {
    return res.status(404).json({ error: { code: "DISABLED", message: "Messages bruts non publiés (conditions d'utilisation de l'OFROU)." } });
  }
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
