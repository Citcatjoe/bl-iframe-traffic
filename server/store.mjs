/**
 * Archive SQLite du prototype (node:sqlite, intégré à Node ≥ 22.13).
 *
 * - polls          : un appel API par ligne (kind = "situations" | "counters"), réussi ou non → sert
 *                    aussi au respect de l'intervalle minimal entre redémarrages.
 * - messages       : une ligne par (situation_id, version), tout le flux, dédoublonné.
 * - observations   : versions des messages des traversées alpines présentes à chaque relevé → séries.
 * - counter_values : mesures par détecteur à chaque relevé compteurs.
 *
 * Schéma v2 (PRAGMA user_version). Une archive v1 (prototype Gothard) est migrée : polls conservé,
 * anciennes tables renommées messages_v1 / observations_v1 (non lues).
 *
 * Migration Firestore : polls/{id}, messages/{situation_id}_{version}, observations et counter_values
 * en sous-collections de polls.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CROSSING_BY_ID, DIRECTIONS, counterReading, crossingRefs, summarizeCrossing } from "../lib/crossings.mjs";

const SCHEMA_VERSION = 2;

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

  // Ligne créée *avant* l'appel (ok = 0, error = 'pending') : un redémarrage pendant l'appel compte comme un appel.
  const insPoll = db.prepare(`INSERT INTO polls (kind, fetched_at, ok, error) VALUES (?, ?, 0, 'pending')`);
  const failPoll = db.prepare(`UPDATE polls SET error = ? WHERE id = ?`);
  const okPoll = db.prepare(`UPDATE polls SET ok = 1, error = NULL, publication_time = ?, n_items = ?, n_matched = ? WHERE id = ?`);
  const upsertMsg = db.prepare(`
    INSERT INTO messages (situation_id, version, first_seen, last_seen, data) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (situation_id, version) DO UPDATE SET last_seen = excluded.last_seen`);
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
  const countersOfPoll = db.prepare(`SELECT * FROM counter_values WHERE poll_id = ?`);
  const countersSince = db.prepare(`
    SELECT c.* FROM counter_values c JOIN polls p ON p.id = c.poll_id
    WHERE p.kind = 'counters' AND p.ok = 1 AND p.fetched_at >= ?`);

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

  const detectorMap = (rows) => Object.fromEntries(rows.map(({ poll_id: _p, detector_id, ...v }) => [detector_id, v]));

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

    /** Dernières mesures compteurs archivées : { fetched_at, detectors } ou null. */
    latestCounters() {
      const p = lastOkPoll.get("counters");
      return p ? { fetched_at: p.fetched_at, detectors: detectorMap(countersOfPoll.all(p.id)) } : null;
    },

    /**
     * Séries d'une traversée : état par relevé "situations" et par sens (même calcul que /api/now,
     * à l'heure du relevé), vitesse et débit du compteur principal par relevé "counters".
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
          situations.push({ t: fetched_at, dir: d, level: x.level, queue_km: x.queue_km, delay_min: x.delay_min });
        }
      }

      const mainCounter = c.counters.find((k) => k.main);
      const counters = [];
      if (mainCounter) {
        const wanted = new Set([...mainCounter.S, ...mainCounter.N]);
        const rowsByPoll = new Map();
        for (const row of countersSince.all(sinceIso)) {
          if (!wanted.has(row.detector_id)) continue;
          if (!rowsByPoll.has(row.poll_id)) rowsByPoll.set(row.poll_id, []);
          rowsByPoll.get(row.poll_id).push(row);
        }
        for (const { id, fetched_at } of pollsSince.all("counters", sinceIso)) {
          const detectors = detectorMap(rowsByPoll.get(id) ?? []);
          for (const d of DIRECTIONS) {
            const r = counterReading(mainCounter[d], detectors);
            counters.push({ t: fetched_at, dir: d, speed_light: r?.speed_light ?? null, flow_light: r?.flow_light ?? null, flow_heavy: r?.flow_heavy ?? null });
          }
        }
      }
      return { situations, counters, counter: mainCounter ? { site: mainCounter.site, name: mainCounter.name } : null };
    },

    close() {
      db.close();
    },
  };
}
