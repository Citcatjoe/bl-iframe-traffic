/**
 * Relevés périodiques : fetch → parse → archive. Un relevé par type ("situations", "counters"),
 * un seul appel en vol par type (setTimeout chaîné). L'intervalle minimal est vérifié contre le
 * dernier relevé *persisté* de ce type, donc aussi à travers les redémarrages (node --watch) :
 * chaque API n'est jamais appelée plus d'une fois par `MIN_INTERVAL_MS`.
 */
import { fetchMeasuredDataXml, fetchTrafficSituationsXml, OtdError } from "../lib/otd-client.mjs";
import { parseTrafficXml } from "../lib/datex.mjs";
import { parseMeasuredDataXml } from "../lib/counters.mjs";
import { COUNTER_DETECTORS } from "../lib/crossings.mjs";

export const MIN_INTERVAL_MS = 2 * 60_000;

function startJob({ kind, apiKey, store, intervalMs, run, complete, describe, onResult, log }) {
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
    const pollId = store.beginPoll(kind, at);
    try {
      const result = await run(at);
      complete(pollId, result);
      state.last_success = at;
      state.last_error = null;
      await onResult?.(result);
      log.info(`[${kind}] ${at} : ${describe(result)}`);
    } catch (e) {
      const code = e instanceof OtdError ? e.code : e.name === "DatexParseError" ? "PARSE" : "INTERNAL";
      // Même erreur qu'au relevé précédent (ex. abonnement manquant) : pas de répétition dans le log.
      if (state.last_error?.code !== code) log.error(`[${kind}] ${at} échec ${code} : ${e.message}`);
      state.last_error = { at, code, message: e.message };
      store.failPoll(pollId, `${code}: ${e.message}`);
    } finally {
      schedule(every);
    }
  }

  if (!apiKey) {
    state.last_error = { at: new Date().toISOString(), code: "NO_KEY", message: "OTD_API_KEY manquante dans .env" };
    log.error(`[${kind}] OTD_API_KEY manquante : aucun appel API. Voir README.`);
  } else {
    const last = store.lastPollAt(kind);
    const wait = last ? Math.max(0, Date.parse(last) + MIN_INTERVAL_MS - Date.now()) : 0;
    if (wait) log.info(`[${kind}] dernier appel à ${last}, prochain dans ${Math.ceil(wait / 1000)} s (intervalle minimal 2 min)`);
    schedule(wait);
  }

  return { state, stop: () => clearTimeout(timer) };
}

/**
 * @param {{ apiKey, countersApiKey?, store, intervalMs, timeoutMs?, onSituations?, onCounters?, log? }} opts
 *   countersApiKey : token d'une application abonnée à « traffic counters » (défaut : apiKey)
 * @returns {{ state: { situations, counters }, stop(): void }}
 */
export function startPoller({ apiKey, countersApiKey = apiKey, store, intervalMs, timeoutMs = 60_000, onSituations, onCounters, log = console }) {
  const situations = startJob({
    kind: "situations",
    apiKey,
    store,
    intervalMs,
    log,
    run: async (at) => parseTrafficXml(await fetchTrafficSituationsXml({ apiKey, timeoutMs }), { fetchedAt: at }),
    complete: (id, snapshot) => store.completeSituationsPoll(id, snapshot),
    describe: (snapshot) => `${snapshot.situations.length} situations`,
    onResult: onSituations,
  });
  const counters = startJob({
    kind: "counters",
    apiKey: countersApiKey,
    store,
    intervalMs,
    log,
    run: async (at) => ({ fetched_at: at, ...parseMeasuredDataXml(await fetchMeasuredDataXml({ apiKey: countersApiKey, detectorIds: COUNTER_DETECTORS })) }),
    complete: (id, measured) => store.completeCountersPoll(id, measured),
    describe: (measured) => `${Object.keys(measured.detectors).length}/${COUNTER_DETECTORS.length} détecteurs`,
    onResult: onCounters,
  });
  return {
    state: { situations: situations.state, counters: counters.state },
    stop: () => {
      situations.stop();
      counters.stop();
    },
  };
}
