/**
 * Archive SQLite du prototype (node:sqlite, intégré à Node ≥ 22.13).
 *
 * - polls          : un appel API par ligne (kind = "situations" | "counters"), réussi ou non → sert
 *                    aussi au respect de l'intervalle minimal entre redémarrages.
 * - messages       : une ligne par (situation_id, version), tout le flux, dédoublonné.
 * - observations   : versions des messages des points suivis présentes à chaque relevé → séries.
 * - counter_values : mesures par détecteur à chaque relevé compteurs.
 *
 * Schéma v2 (PRAGMA user_version). Une archive v1 (prototype Gothard) est migrée : polls conservé,
 * anciennes tables renommées messages_v1 / observations_v1 (non lues).
 *
 * Plan n8n + Firestore (PLAN-N8N-FIRESTORE.md) : cette archive n'y est pas reprise ; seuls l'état courant, les
 * fiches et 24 h d'historique sont publiés.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { COUNTER_DETECTORS, COUNTER_SILENT_H, COUNTER_WINDOW_MIN, CROSSING_BY_ID, DIRECTIONS, counterWindow, crossingRefs, summarizeCrossing } from "../lib/crossings.mjs";

const SCHEMA_VERSION = 2;
const WINDOW_MS = COUNTER_WINDOW_MIN * 60_000;
const SILENT_MS = COUNTER_SILENT_H * 3600_000;
// Écart entre deux relevés compteurs au-delà duquel l'observation est interrompue (serveur arrêté, erreurs API).
const MAX_POLL_GAP_MS = 15 * 60_000;
const isoAt = (ms) => new Date(ms).toISOString();

function migrate(db) {
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version >= SCHEMA_VERSION) return;
  const hasTable = (name) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
  db.exec("BEGIN");
  try {
    if (hasTable("polls")) {
      // v1 : polls(id, fetched_at, ok, error, publication_time, n_situations, n_gothard), relevés "situations" seulement.
      db.exec(`
        ALTER TABLE polls ADD COLUMN kind TEXT NOT NULL DEFAULT 'situations';
        ALTER TABLE polls RENAME COLUMN n_situations TO n_items;
        ALTER TABLE polls RENAME COLUMN n_gothard TO n_matched;
      `);
      if (hasTable("messages")) db.exec("ALTER TABLE messages RENAME TO messages_v1");
      if (hasTable("observations")) db.exec("ALTER TABLE observations RENAME TO observations_v1");
    } else {
      db.exec(`
        CREATE TABLE polls (
          id               INTEGER PRIMARY KEY,
          kind             TEXT NOT NULL,
          fetched_at       TEXT NOT NULL,
          ok               INTEGER NOT NULL,
          error            TEXT,
          publication_time TEXT,
          n_items          INTEGER,
          n_matched        INTEGER
        );`);
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS polls_kind_fetched_at ON polls (kind, fetched_at);
      CREATE TABLE messages (
        situation_id TEXT NOT NULL,
        version      INTEGER NOT NULL,
        first_seen   TEXT NOT NULL,
        last_seen    TEXT NOT NULL,
        data         TEXT NOT NULL,
        PRIMARY KEY (situation_id, version)
      );
      CREATE TABLE observations (
        poll_id      INTEGER NOT NULL REFERENCES polls (id),
        situation_id TEXT NOT NULL,
        version      INTEGER NOT NULL,
        PRIMARY KEY (poll_id, situation_id)
      );
      CREATE TABLE counter_values (
        poll_id      INTEGER NOT NULL REFERENCES polls (id),
        detector_id  TEXT NOT NULL,
        measured_at  TEXT,
        flow_light   REAL,
        speed_light  REAL,
        flow_heavy   REAL,
        speed_heavy  REAL,
        PRIMARY KEY (poll_id, detector_id)
      );
      PRAGMA user_version = ${SCHEMA_VERSION};
    `);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function openStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  // Hors migration (idempotent) : dernière minute avec un véhicule par détecteur, sans parcourir l'archive.
  db.exec("CREATE INDEX IF NOT EXISTS counter_values_vehicle ON counter_values (detector_id, measured_at) WHERE flow_light > 0 OR flow_heavy > 0");

  // Ligne créée *avant* l'appel (ok = 0, error = 'pending') : un redémarrage pendant l'appel compte comme un appel.
  const insPoll = db.prepare(`INSERT INTO polls (kind, fetched_at, ok, error) VALUES (?, ?, 0, 'pending')`);
  const failPoll = db.prepare(`UPDATE polls SET error = ? WHERE id = ?`);
  const okPoll = db.prepare(`UPDATE polls SET ok = 1, error = NULL, publication_time = ?, n_items = ?, n_matched = ? WHERE id = ?`);
  // `data` réécrit à chaque relevé : une version encore en cours suit les évolutions du parseur (sinon l'historique
  // la lit telle qu'analysée à sa première apparition, parfois des semaines plus tôt).
  const upsertMsg = db.prepare(`
    INSERT INTO messages (situation_id, version, first_seen, last_seen, data) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (situation_id, version) DO UPDATE SET last_seen = excluded.last_seen, data = excluded.data`);
  const insObs = db.prepare(`INSERT OR IGNORE INTO observations (poll_id, situation_id, version) VALUES (?, ?, ?)`);
  const insCounter = db.prepare(`
    INSERT OR REPLACE INTO counter_values (poll_id, detector_id, measured_at, flow_light, speed_light, flow_heavy, speed_heavy)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const lastPollStmt = db.prepare(`SELECT fetched_at FROM polls WHERE kind = ? ORDER BY id DESC LIMIT 1`);
  const lastOkPoll = db.prepare(`SELECT id, fetched_at FROM polls WHERE kind = ? AND ok = 1 ORDER BY id DESC LIMIT 1`);
  const pollsSince = db.prepare(`SELECT id, fetched_at FROM polls WHERE kind = ? AND ok = 1 AND fetched_at >= ? ORDER BY fetched_at`);
  const obsSince = db.prepare(`
    SELECT o.poll_id, m.situation_id, m.version, m.data FROM observations o
    JOIN polls p ON p.id = o.poll_id
    JOIN messages m ON m.situation_id = o.situation_id AND m.version = o.version
    WHERE p.kind = 'situations' AND p.ok = 1 AND p.fetched_at >= ?`);
  const countersSince = db.prepare(`
    SELECT c.* FROM counter_values c JOIN polls p ON p.id = c.poll_id
    WHERE p.kind = 'counters' AND p.ok = 1 AND p.fetched_at >= ?`);
  const lastVehicle = db.prepare(`
    SELECT MAX(measured_at) AS t FROM counter_values WHERE detector_id = ? AND (flow_light > 0 OR flow_heavy > 0)`);

  /** Relevés compteurs réussis sans trou de plus de MAX_POLL_GAP_MS entre `sinceMs` et `untilMs`. */
  const countersContinuous = (sinceMs, untilMs) => {
    let prev = sinceMs;
    for (const { fetched_at } of pollsSince.all("counters", isoAt(sinceMs))) {
      const t = Date.parse(fetched_at);
      if (t > untilMs) break;
      if (t - prev > MAX_POLL_GAP_MS) return false;
      prev = t;
    }
    return untilMs - prev <= MAX_POLL_GAP_MS;
  };

  const tx = (fn) => {
    db.exec("BEGIN");
    try {
      fn();
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };

  return {
    /** Dernier appel tenté (réussi, échoué ou interrompu) de ce type, ISO, ou null. */
    lastPollAt(kind) {
      return lastPollStmt.get(kind)?.fetched_at ?? null;
    },

    /** À appeler juste avant l'appel API. @returns {number} id du relevé */
    beginPoll(kind, fetchedAt) {
      return Number(insPoll.run(kind, fetchedAt).lastInsertRowid);
    },

    failPoll(pollId, error) {
      failPoll.run(String(error).slice(0, 500), pollId);
    },

    /** @param {{ fetched_at, publication_time, situations }} snapshot  sortie de parseTrafficXml */
    completeSituationsPoll(pollId, snapshot) {
      const { fetched_at: at, situations } = snapshot;
      const matched = situations.filter((s) => crossingRefs(s).length);
      tx(() => {
        okPoll.run(snapshot.publication_time, situations.length, matched.length, pollId);
        for (const s of situations) upsertMsg.run(s.situation_id, s.version, at, at, JSON.stringify(s));
        for (const s of matched) insObs.run(pollId, s.situation_id, s.version);
      });
    },

    /** @param {{ publication_time, detectors }} measured  sortie de parseMeasuredDataXml */
    completeCountersPoll(pollId, measured) {
      const entries = Object.entries(measured.detectors);
      tx(() => {
        okPoll.run(measured.publication_time, entries.length, entries.length, pollId);
        for (const [id, v] of entries) {
          insCounter.run(pollId, id, v.measured_at, v.flow_light, v.speed_light, v.flow_heavy, v.speed_heavy);
        }
      });
    },

    /**
     * Mesures compteurs des COUNTER_WINDOW_MIN minutes précédant le dernier relevé, dernière minute avec un
     * véhicule par détecteur, seuil « muet » : { fetched_at, ...CounterWindow } ou null.
     */
    counterWindow() {
      const p = lastOkPoll.get("counters");
      if (!p) return null;
      const at = Date.parse(p.fetched_at);
      const last_vehicle = Object.fromEntries(COUNTER_DETECTORS.map((id) => [id, lastVehicle.get(id)?.t ?? null]));
      const silent_before = countersContinuous(at - SILENT_MS, at) ? isoAt(at - SILENT_MS) : null;
      const since = isoAt(at - WINDOW_MS);
      return { fetched_at: p.fetched_at, ...counterWindow(countersSince.all(since), { last_vehicle, silent_before, since }) };
    },

    /**
     * Série d'un point : état par relevé "situations" et par sens, même calcul que /api/now à l'heure du relevé
     * (niveau, km, temps perdu annoncé ; tronçon, motif et chantier du message le plus grave).
     */
    history(crossingId, sinceIso) {
      const c = CROSSING_BY_ID[crossingId];
      if (!c) return null;

      const parsed = new Map();
      const byPoll = new Map();
      for (const row of obsSince.all(sinceIso)) {
        const key = `${row.situation_id}#${row.version}`;
        if (!parsed.has(key)) parsed.set(key, JSON.parse(row.data));
        const s = parsed.get(key);
        if (!crossingRefs(s).some((r) => r.id === crossingId)) continue;
        if (!byPoll.has(row.poll_id)) byPoll.set(row.poll_id, []);
        byPoll.get(row.poll_id).push(s);
      }
      const situations = [];
      for (const { id, fetched_at } of pollsSince.all("situations", sinceIso)) {
        const sum = summarizeCrossing(c, byPoll.get(id) ?? [], fetched_at);
        for (const d of DIRECTIONS) {
          const x = sum.directions[d];
          const m = x.messages[0];
          situations.push({
            t: fetched_at,
            dir: d,
            level: x.level,
            queue_km: x.queue_km,
            delay_min: x.delay_min,
            section_fr: m?.section_fr ?? null,
            reason_fr: m?.reason_fr ?? null,
            roadworks: m?.roadworks ?? false,
          });
        }
      }
      return { situations };
    },

    close() {
      db.close();
    },
  };
}
