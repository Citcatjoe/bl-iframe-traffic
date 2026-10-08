/**
 * Archive SQLite du prototype (node:sqlite, intégré à Node ≥ 22.13).
 *
 * - polls        : un relevé par appel API (réussi ou non) → sert aussi au respect de l'intervalle minimal
 *                  entre redémarrages.
 * - messages     : une ligne par (situation_id, version), tout le flux, dédoublonné.
 * - observations : quelles versions de messages Gothard étaient présentes à chaque relevé → séries temporelles.
 *
 * Migration Firestore : polls/{id}, messages/{situation_id}_{version}, observations en sous-collection de polls.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { directionStats } from "../lib/datex.mjs";

export function openStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS polls (
      id               INTEGER PRIMARY KEY,
      fetched_at       TEXT NOT NULL,
      ok               INTEGER NOT NULL,
      error            TEXT,
      publication_time TEXT,
      n_situations     INTEGER,
      n_gothard        INTEGER
    );
    CREATE INDEX IF NOT EXISTS polls_fetched_at ON polls (fetched_at);
    CREATE TABLE IF NOT EXISTS messages (
      situation_id TEXT NOT NULL,
      version      INTEGER NOT NULL,
      first_seen   TEXT NOT NULL,
      last_seen    TEXT NOT NULL,
      is_gothard   INTEGER NOT NULL,
      data         TEXT NOT NULL,
      PRIMARY KEY (situation_id, version)
    );
    CREATE TABLE IF NOT EXISTS observations (
      poll_id      INTEGER NOT NULL REFERENCES polls (id),
      situation_id TEXT NOT NULL,
      version      INTEGER NOT NULL,
      PRIMARY KEY (poll_id, situation_id)
    );
  `);

  // Ligne créée *avant* l'appel (ok = 0, error = 'pending') : un redémarrage pendant l'appel compte comme un appel.
  const insPoll = db.prepare(`INSERT INTO polls (fetched_at, ok, error) VALUES (?, 0, 'pending')`);
  const failPoll = db.prepare(`UPDATE polls SET error = ? WHERE id = ?`);
  const okPoll = db.prepare(
    `UPDATE polls SET ok = 1, error = NULL, publication_time = ?, n_situations = ?, n_gothard = ? WHERE id = ?`,
  );
  const upsertMsg = db.prepare(`
    INSERT INTO messages (situation_id, version, first_seen, last_seen, is_gothard, data) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (situation_id, version) DO UPDATE SET last_seen = excluded.last_seen`);
  const insObs = db.prepare(`INSERT OR IGNORE INTO observations (poll_id, situation_id, version) VALUES (?, ?, ?)`);
  const lastPollStmt = db.prepare(`SELECT fetched_at FROM polls ORDER BY id DESC LIMIT 1`);
  const pollsSince = db.prepare(`SELECT id, fetched_at FROM polls WHERE ok = 1 AND fetched_at >= ? ORDER BY fetched_at`);
  const obsSince = db.prepare(`
    SELECT o.poll_id, m.data FROM observations o
    JOIN polls p ON p.id = o.poll_id
    JOIN messages m ON m.situation_id = o.situation_id AND m.version = o.version
    WHERE p.ok = 1 AND p.fetched_at >= ?`);

  return {
    /** Dernier appel tenté (réussi, échoué ou interrompu), ISO, ou null. */
    lastPollAt() {
      return lastPollStmt.get()?.fetched_at ?? null;
    },

    /** À appeler juste avant l'appel API. @returns {number} id du relevé */
    beginPoll(fetchedAt) {
      return Number(insPoll.run(fetchedAt).lastInsertRowid);
    },

    failPoll(pollId, error) {
      failPoll.run(String(error).slice(0, 500), pollId);
    },

    /** @param {{ fetched_at, publication_time, situations }} snapshot */
    completePoll(pollId, snapshot) {
      const { fetched_at: at, situations } = snapshot;
      const gothard = situations.filter((s) => s.is_gothard);
      db.exec("BEGIN");
      try {
        okPoll.run(snapshot.publication_time, situations.length, gothard.length, pollId);
        for (const s of situations) {
          upsertMsg.run(s.situation_id, s.version, at, at, s.is_gothard ? 1 : 0, JSON.stringify(s));
        }
        for (const s of gothard) insObs.run(pollId, s.situation_id, s.version);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },

    /**
     * Série temporelle : un point par relevé réussi et par sens.
     * queue_km = plus long bouchon actif du sens (0 si aucun), delay_min = plus grand temps perdu annoncé (null si aucun).
     */
    history(sinceIso) {
      const byPoll = new Map();
      for (const row of obsSince.all(sinceIso)) {
        if (!byPoll.has(row.poll_id)) byPoll.set(row.poll_id, []);
        byPoll.get(row.poll_id).push(JSON.parse(row.data));
      }
      const series = [];
      for (const { id, fetched_at } of pollsSince.all(sinceIso)) {
        const situations = byPoll.get(id) ?? [];
        for (const direction of ["N-S", "S-N"]) {
          const { jams, queue_km, delay_min } = directionStats(situations, direction);
          series.push({ t: fetched_at, direction, queue_km, delay_min, jams: jams.length });
        }
      }
      return series;
    },

    close() {
      db.close();
    },
  };
}
