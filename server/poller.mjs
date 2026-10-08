/**
 * Relevé périodique : fetch → parse → archive. Un seul appel en vol à la fois (setTimeout chaîné).
 * L'intervalle minimal est vérifié contre le dernier relevé *persisté*, donc aussi à travers
 * les redémarrages (node --watch) : l'API n'est jamais appelée plus d'une fois par `minIntervalMs`.
 */
import { fetchTrafficSituationsXml, OtdError } from "../lib/otd-client.mjs";
import { parseTrafficXml } from "../lib/datex.mjs";

export const MIN_INTERVAL_MS = 2 * 60_000;

export function startPoller({ apiKey, store, intervalMs, timeoutMs = 60_000, onSnapshot, log = console }) {
  const every = Math.max(intervalMs, MIN_INTERVAL_MS);
  const state = { interval_s: every / 1000, last_attempt: null, last_success: null, last_error: null, next_poll: null };
  let timer = null;

  const schedule = (ms) => {
    state.next_poll = new Date(Date.now() + ms).toISOString();
    timer = setTimeout(tick, ms);
  };

  async function tick() {
    const at = new Date().toISOString();
    state.last_attempt = at;
    const pollId = store.beginPoll(at);
    try {
      const xml = await fetchTrafficSituationsXml({ apiKey, timeoutMs });
      const snapshot = parseTrafficXml(xml, { fetchedAt: at });
      store.completePoll(pollId, snapshot);
      state.last_success = at;
      state.last_error = null;
      await onSnapshot?.(snapshot);
      const g = snapshot.situations.filter((s) => s.is_gothard).length;
      log.info(`[poll] ${at} : ${snapshot.situations.length} situations, ${g} Gothard`);
    } catch (e) {
      const code = e instanceof OtdError ? e.code : e.name === "DatexParseError" ? "PARSE" : "INTERNAL";
      state.last_error = { at, code, message: e.message };
      store.failPoll(pollId, `${code}: ${e.message}`);
      log.error(`[poll] ${at} échec ${code} : ${e.message}`);
    } finally {
      schedule(every);
    }
  }

  if (!apiKey) {
    state.last_error = { at: new Date().toISOString(), code: "NO_KEY", message: "OTD_API_KEY manquante dans .env" };
    log.error("[poll] OTD_API_KEY manquante : aucun appel API. Voir README.");
  } else {
    const last = store.lastPollAt();
    const wait = last ? Math.max(0, Date.parse(last) + MIN_INTERVAL_MS - Date.now()) : 0;
    if (wait) log.info(`[poll] dernier appel à ${last}, prochain dans ${Math.ceil(wait / 1000)} s (intervalle minimal 2 min)`);
    schedule(wait);
  }

  return {
    state,
    stop: () => clearTimeout(timer),
  };
}
