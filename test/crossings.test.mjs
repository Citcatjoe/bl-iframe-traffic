// Traversées alpines : rattachement des messages réels (test/fixtures/sample.xml) et état par sens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTrafficXml } from "../lib/datex.mjs";
import { parseMeasuredDataXml } from "../lib/counters.mjs";
import { COUNTER_DETECTORS, CROSSING_BY_ID, counterReading, crossingRefs, summarizeCrossing } from "../lib/crossings.mjs";

const xml = readFileSync(new URL("./fixtures/sample.xml", import.meta.url), "utf8");
const { situations } = parseTrafficXml(xml);
const byId = Object.fromEntries(situations.map((s) => [s.situation_id.replace(/^situation\.|\.1$/g, ""), s]));
const refs = (id) => crossingRefs(byId[id]).map((r) => `${r.id}/${r.segment}/${r.dir}`);

test("rattachement sur le lieu, pas sur l'extrémité d'itinéraire", () => {
  assert.deepEqual(refs("658214"), ["gothard/main/S"]); // Amsteg – Göschenen
  assert.deepEqual(refs("287191"), ["gothard/main/both"]); // Tunnel Gotthard-Tunnel
  assert.deepEqual(refs("658270"), []); // A2 Basel -> Luzern, Augst – Sissach
  assert.deepEqual(refs("613971"), []); // H11 Meiringen <-> Wassen (Susten) : Wassen n'est qu'une extrémité
});

test("col du Gothard séparé du tunnel ; H2 de la vallée exclu", () => {
  assert.deepEqual(refs("658222"), ["gothard/pass/both"]); // Airolo-Nufenen – Hospental
  assert.deepEqual(refs("658237"), []); // H2 Flüelen -> Göschenen, Erstfeld – Göschenen
});

test("autres traversées", () => {
  assert.deepEqual(refs("651708"), ["san-bernardino/main/both"]);
  assert.deepEqual(refs("655961"), ["san-bernardino/main/both"]);
  assert.deepEqual(refs("658281"), ["simplon/main/both"]);
});

test("sens : flèche du texte, sinon alertC selon la route", () => {
  assert.equal(crossingRefs(byId["658215"])[0].dir, "N"); // Chiasso -> Gotthard
  // alertC : A9 positive = vers le sud (inverse de l'A2)
  const simplon = { ...byId["658281"], route_arrow: null, alertc_direction: "positive" };
  assert.equal(crossingRefs(simplon)[0].dir, "S");
  const gothard = { ...byId["658214"], route_arrow: null, alertc_direction: "positive" };
  assert.equal(crossingRefs(gothard)[0].dir, "N");
});

test("Gothard au relevé : tunnel fermé dans les deux sens, bouchons et estimation d'attente", () => {
  const g = summarizeCrossing(CROSSING_BY_ID.gothard, situations, "2026-10-08T13:45:00.000Z");
  assert.equal(g.level, "closed");
  assert.deepEqual([g.directions.S.level, g.directions.N.level], ["closed", "closed"]);
  assert.deepEqual([g.directions.S.queue_km, g.directions.N.queue_km], [4, 5]);
  assert.deepEqual(g.directions.S.delay_estimate, { min: 40, max: 48 });
  assert.equal(g.directions.S.since, byId["658214"].created_time);
  // fermeture du col à 18:00 locale : pas encore, mais annoncée
  assert.equal(g.pass.closed, false);
  assert.equal(g.upcoming[0].situation_id, "situation.658222.1");
  assert.equal(g.upcoming[0].next_start, "2026-10-08T16:00:00.000Z");
});

test("San Bernardino : fermeture nocturne avec déviation locale, puis fermeture sans déviation", () => {
  const c = CROSSING_BY_ID["san-bernardino"];
  assert.equal(summarizeCrossing(c, situations, "2026-10-12T10:00:00.000Z").level, "clear");
  assert.equal(summarizeCrossing(c, situations, "2026-10-12T20:30:00.000Z").level, "detour");
  assert.equal(summarizeCrossing(c, situations, "2026-10-21T20:30:00.000Z").level, "closed");
  // de jour, heure quelconque : prochaine nuit annoncée à 22:00 locale pile
  const day = summarizeCrossing(c, situations, "2026-10-12T10:03:48.981Z");
  assert.equal(day.upcoming[0].next_start, "2026-10-12T20:00:00.000Z");
});

test("mesures compteurs : débits additionnés, vitesse pondérée par le débit", () => {
  // Exemple officiel du cookbook « Traffic counters » (CH:0677, 4 voies)
  const { detectors } = parseMeasuredDataXml(readFileSync(new URL("./fixtures/measured-data.xml", import.meta.url), "utf8"));
  assert.deepEqual(detectors["CH:0677.01"], {
    measured_at: "2024-09-20T09:59:00.000Z",
    flow_light: 1200,
    speed_light: 76.5,
    flow_heavy: 60,
    speed_heavy: 67,
  });
  assert.equal(detectors["CH:0677.03"].speed_heavy, null); // aucun poids lourd pendant la minute
  const r = counterReading(["CH:0677.01", "CH:0677.03"], detectors);
  assert.equal(r.flow_light, 2040);
  assert.equal(r.flow_heavy, 60);
  assert.equal(r.speed_light, Math.round((1200 * 76.5 + 840 * 66.9000015) / 2040));
  assert.equal(counterReading(["CH:9999.01"], detectors), null);
});

test("réponse réelle des compteurs (12.10.2026) : tous les détecteurs, valeurs en erreur écartées", () => {
  const { detectors } = parseMeasuredDataXml(readFileSync(new URL("./fixtures/measured-data-live.xml", import.meta.url), "utf8"));
  assert.deepEqual(COUNTER_DETECTORS.filter((id) => !detectors[id]), []);
  // Gondo vers le nord : vitesses marquées dataError (SENSOR_WWD), débits conservés
  assert.deepEqual(detectors["CH:0527.02"], { measured_at: "2026-10-12T08:31:00.000Z", flow_light: 60, speed_light: null, flow_heavy: 60, speed_heavy: null });
  const tunnel = counterReading(CROSSING_BY_ID.gothard.counters[0].S, detectors);
  assert.deepEqual(tunnel, { measured_at: "2026-10-12T08:31:00.000Z", flow_light: 840, flow_heavy: 0, speed_light: 72 });
});
