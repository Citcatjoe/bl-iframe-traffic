// Points suivis : rattachement des messages réels (test/fixtures/sample.xml) et état par sens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTrafficXml } from "../lib/datex.mjs";
import { parseMeasuredDataXml } from "../lib/counters.mjs";
import { CROSSING_BY_ID, counterReading, counterWindow, crossingRefs, sectionFr, summarizeCrossing } from "../lib/crossings.mjs";

const xml = readFileSync(new URL("./fixtures/sample.xml", import.meta.url), "utf8");
const { situations } = parseTrafficXml(xml);
const byId = Object.fromEntries(situations.map((s) => [s.situation_id.replace(/^situation\.|\.1$/g, ""), s]));
const refsOf = (s) => crossingRefs(s).map((r) => `${r.id}/${r.dir}`);
const refs = (id) => refsOf(byId[id]);
/** En-tête d'un message réel de l'archive, sur la base d'un message du fixture. */
const msg = (road, from, arrow, to, location_de, alertc_direction) => ({ ...byId["658214"], road, route_from: from, route_arrow: arrow, route_to: to, location_de, alertc_direction });

test("rattachement sur le lieu, pas sur l'extrémité d'itinéraire", () => {
  assert.deepEqual(refs("658214"), ["gothard/a"]); // Amsteg – Göschenen
  assert.deepEqual(refs("287191"), ["gothard/both"]); // Tunnel Gotthard-Tunnel
  assert.deepEqual(refs("658270"), []); // A2 Basel -> Luzern, Augst – Sissach
  assert.deepEqual(refs("613971"), []); // H11 Meiringen <-> Wassen (Susten) : Wassen n'est qu'une extrémité
  assert.deepEqual(refsOf(msg("A2", "Gotthard", "->", "Luzern", "zwischen Raststätte Gotthard und Autobahndreieck Verzweigung Altdorf", "positive")), []);
});

test("col du Gothard séparé du tunnel ; H2 de la vallée exclu", () => {
  assert.deepEqual(refs("658222"), ["col-du-gothard/both"]); // Airolo-Nufenen – Hospental
  assert.deepEqual(refs("658237"), []); // H2 Flüelen -> Göschenen, Erstfeld – Göschenen
});

test("tunnel et col : jonctions A13 au tunnel ; col du Grand-Saint-Bernard annoncé sans numéro de route", () => {
  assert.deepEqual(refs("651708"), ["san-bernardino/both"]); // Pian San Giacomo – Passstrasse (jonction A13)
  assert.deepEqual(refs("655961"), ["san-bernardino/both"]); // San Bernardino – San Bernardino-Pass (jonction A13)
  // Fermeture hivernale réelle (situation 659580), en-tête sans route : remplace l'en-tête d'un message du fixture.
  const col = parseTrafficXml(
    xml.replace("H2 Airolo &lt;-&gt; Göschenen zwischen Anschluss Airolo-Nufenen und Ortschaft Hospental", "Bourg-St-Bernard -&gt; St-Oyen zwischen Pass Grosser St. Bernhard Pass und Ortschaft St-Oyen"),
  ).situations.find((s) => s.situation_id === "situation.658222.1");
  assert.deepEqual([col.road, col.route_from, col.route_to], [null, "Bourg-St-Bernard", "St-Oyen"]);
  assert.deepEqual(refsOf(col), ["col-du-grand-st-bernard/a"]);
  assert.deepEqual(refsOf(msg("H21", "Grosser St. Bernhard", "<->", "Martigny", "zwischen Ortschaft Bourg-St-Pierre und Ortschaft Bourg-St-Bernard", "both")), ["grand-st-bernard/both"]);
});

test("fermeture hivernale rattachée aux seuls cols, jamais à un tunnel, même sur sa route d'accès (situation 664151, 05.11.2026)", () => {
  const winter = { ...msg("H21", "Grosser St. Bernhard", "<->", "Martigny", "zwischen Ortschaft Bourg-St-Bernard und Ortschaft Martigny", "both"), text_de: "Freigegeben: H21 Grosser St. Bernhard <-> Martigny zwischen Ortschaft Bourg-St-Bernard und Ortschaft Martigny Sachlage: Strecke gesperrt Ursache: Wintersperre" };
  assert.deepEqual(refsOf(winter), []);
  // même tronçon, autre cause : reste au tunnel
  assert.deepEqual(refsOf({ ...winter, text_de: winter.text_de.replace("Wintersperre", "Unfall") }), ["grand-st-bernard/both"]);
  // sur le col, la fermeture hivernale reste rattachée ; sur un axe, jamais
  const wd = (m) => ({ ...m, text_de: "Sachlage: Strecke gesperrt Ursache: Wintersperre" });
  assert.deepEqual(refsOf(wd(msg(null, "Bourg-St-Bernard", "<->", "St-Oyen", "zwischen Ortschaft Bourg-St-Bernard und Pass Grosser St. Bernhard Pass", "both"))), ["col-du-grand-st-bernard/both"]);
  assert.deepEqual(refsOf(wd(msg("A1", "Lausanne", "->", "Genf", "zwischen Anschluss Rolle und Anschluss Gland", "negative"))), []);
});

test("axe Lausanne – Genève et douane de Bardonnex sur la même A1, séparés par le lieu", () => {
  assert.deepEqual(refsOf(msg("A1", "Lausanne", "->", "Genf", "zwischen Anschluss Rolle und Anschluss Gland", "negative")), ["lausanne-geneve/a"]);
  assert.deepEqual(refsOf(msg("A1", "Lausanne", "->", "Genf", "zwischen Anschluss Flughafen Genf und Zollstation Bardonnex", "negative")), ["douane-bardonnex/a"]);
  assert.deepEqual(refsOf(msg("A1", "Genf", "->", "Yverdon", "zwischen Autobahndreieck Verzweigung Villars-Ste-Croix und Anschluss Cossonay", "positive")), []);
});

test("sens : flèche du texte, sinon signe alertC propre à la route", () => {
  assert.equal(crossingRefs(byId["658215"])[0].dir, "b"); // Chiasso -> Gotthard
  assert.deepEqual(refsOf({ ...byId["658214"], route_arrow: null, alertc_direction: "positive" }), ["gothard/b"]);
  // A9 : positive = vers le Valais (sens a de Lausanne – Valais), negative = vers la France (sens a de Vallorbe)
  assert.deepEqual(refsOf(msg("A9", "Vevey", null, null, "zwischen Anschluss St-Triphon und Anschluss Villeneuve", "positive")), ["lausanne-valais/a"]);
  assert.deepEqual(refsOf(msg("A9", "Lausanne", null, null, "zwischen Anschluss Ballaigues und Zollstation Vallorbe", "negative")), ["douane-vallorbe/a"]);
  // Grand-Saint-Bernard : vers l'Italie = positive sur l'A21, negative sur le H21
  assert.deepEqual(refsOf(msg("A21", null, null, null, "zwischen Anschluss Martigny-Expo und Anschluss Martigny-Croix", "positive")), ["grand-st-bernard/a"]);
  assert.deepEqual(refsOf(msg("H21", null, null, null, "zwischen Ortschaft Sembrancher und Ortschaft Orsières", "negative")), ["grand-st-bernard/a"]);
});

test("Gothard au relevé : tunnel fermé dans les deux sens, bouchons et estimation d'attente ; col annoncé", () => {
  const g = summarizeCrossing(CROSSING_BY_ID.gothard, situations, "2026-10-08T13:45:00.000Z");
  assert.equal(g.level, "closed");
  assert.deepEqual([g.directions.a.level, g.directions.b.level], ["closed", "closed"]);
  assert.deepEqual([g.directions.a.queue_km, g.directions.b.queue_km], [4, 5]);
  assert.deepEqual(g.directions.a.delay_estimate, { min: 40, max: 48 });
  assert.equal(g.directions.a.since, byId["658214"].created_time);
  // fermeture du col à 18:00 locale : pas encore, mais annoncée sur le point du col
  const col = summarizeCrossing(CROSSING_BY_ID["col-du-gothard"], situations, "2026-10-08T13:45:00.000Z");
  assert.equal(col.level, "clear");
  assert.equal(col.upcoming[0].situation_id, "situation.658222.1");
  assert.equal(col.upcoming[0].next_start, "2026-10-08T16:00:00.000Z");
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

test("col du Simplon : A9 Brigue – Gondo, sans confusion avec les autres points de l'A9", () => {
  assert.deepEqual(refs("658281"), ["simplon/both"]);
  assert.deepEqual(refsOf(msg("A9", "Domodossola", "->", "Brig", "zwischen Zollstation Gondo und Ortschaft Gabi", "negative")), ["simplon/b"]);
  assert.deepEqual(refsOf(msg("A9", "Sion", "->", "Domodossola", "zwischen Anschluss Brig-Glis und Ortschaft Berisal", "positive")), ["simplon/a"]);
  // signe alertC seul : A9 positive = vers l'Italie
  assert.deepEqual(refsOf(msg("A9", null, null, null, "zwischen Ortschaft Simplon-Dorf und Ortschaft Gabi", "positive")), ["simplon/a"]);
});

test("tronçon touché en français, tiré du lieu de l'en-tête DE", () => {
  assert.equal(sectionFr("zwischen Anschluss Montreux und Anschluss Villeneuve"), "entre Montreux et Villeneuve");
  assert.equal(sectionFr("zwischen Anschluss Bex-Süd und Anschluss St-Maurice"), "entre Bex-Sud et St-Maurice");
  assert.equal(sectionFr("zwischen Anschluss Flughafen Genf und Zollstation Bardonnex"), "entre Genève-Aéroport et Bardonnex");
  assert.equal(sectionFr("zwischen Pass Gotthard-Pass und Ortschaft Motto Bartola"), "entre le col du Gothard et Motto Bartola");
  assert.equal(sectionFr("Tunnel Gotthard-Tunnel, bei Kilometer 11.43"), "dans le tunnel du Gothard");
  assert.equal(sectionFr("Anschluss Perly Nord"), "à Perly Nord");
  assert.equal(sectionFr(null), null);
});

const rowsOf = (detectors) => Object.entries(detectors).map(([detector_id, v]) => ({ detector_id, ...v }));

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
  const win = counterWindow(rowsOf(detectors));
  const r = counterReading(["CH:0677.01", "CH:0677.03"], win);
  assert.equal(r.flow_light, 2040);
  assert.equal(r.flow_heavy, 60);
  assert.equal(r.speed_light, Math.round((1200 * 76.5 + 840 * 66.9000015) / 2040));
  assert.equal(counterReading(["CH:9999.01"], win), null);
});

test("réponse réelle des compteurs (12.10.2026) : valeurs en erreur écartées", () => {
  const { detectors } = parseMeasuredDataXml(readFileSync(new URL("./fixtures/measured-data-live.xml", import.meta.url), "utf8"));
  // Gondo vers le nord : vitesses marquées dataError (SENSOR_WWD), débits conservés
  assert.deepEqual(detectors["CH:0527.02"], { measured_at: "2026-10-12T08:31:00.000Z", flow_light: 60, speed_light: null, flow_heavy: 60, speed_heavy: null });
  const tunnel = counterReading(CROSSING_BY_ID.gothard.counters[0].a, counterWindow(rowsOf(detectors)));
  assert.equal(tunnel.measured_at, "2026-10-12T08:31:00.000Z");
  assert.deepEqual([tunnel.flow_light, tunnel.flow_heavy, tunnel.speed_light, tunnel.silent], [840, 0, 72, false]);
});

test("fenêtre de lissage : débit moyen par voie, vitesse pondérée sur toutes les minutes, minute relue une fois", () => {
  const m = (detector_id, minute, flow_light, speed_light) => ({ detector_id, measured_at: `2026-10-26T12:0${minute}:00.000Z`, flow_light, speed_light, flow_heavy: 0, speed_heavy: null });
  const rows = [m("A.01", 1, 600, 60), m("A.01", 4, 1200, 90), m("A.01", 4, 1200, 90), m("A.02", 1, 0, null), m("A.02", 4, 60, 100)];
  const r = counterReading(["A.01", "A.02"], counterWindow(rows));
  assert.equal(r.flow_light, 900 + 30);
  assert.equal(r.speed_light, Math.round((600 * 60 + 1200 * 90 + 60 * 100) / 1860));
  assert.equal(r.measured_at, "2026-10-26T12:04:00.000Z");
});

test("mesure figée : une minute antérieure à la fenêtre n'est pas une mesure actuelle, même relue au dernier relevé", () => {
  const row = (detector_id, measured_at, flow_light) => ({ detector_id, measured_at, flow_light, speed_light: 80, flow_heavy: 0, speed_heavy: null });
  const since = "2026-11-05T12:04:00.000Z";
  const rows = [row("F.01", "2026-11-05T01:18:00.000Z", 60), row("F.02", null, 60), row("A.01", "2026-11-05T12:04:00.000Z", 600), row("A.01", "2026-11-05T12:12:00.000Z", 1200)];
  const win = counterWindow(rows, { since });
  assert.equal(counterReading(["F.01"], win), null);
  assert.equal(counterReading(["F.02"], win), null);
  // une voie figée n'entre pas dans le débit du sens, la voie à jour oui (bornes de la fenêtre comprises)
  const r = counterReading(["A.01", "F.01"], win);
  assert.deepEqual([r.flow_light, r.measured_at], [900, "2026-11-05T12:12:00.000Z"]);
});

test("compteur muet : aucun véhicule sur aucune voie depuis le seuil, et seulement si les relevés sont continus", () => {
  const rows = [{ detector_id: "T.01", measured_at: "2026-10-26T12:00:00.000Z", flow_light: 0, speed_light: null, flow_heavy: 0, speed_heavy: null }];
  const last_vehicle = { "T.01": "2026-10-21T06:56:00.000Z", "T.02": "2026-10-26T11:59:00.000Z" };
  const silent_before = "2026-10-26T06:00:00.000Z";
  const one = counterReading(["T.01"], counterWindow(rows, { last_vehicle, silent_before }));
  assert.deepEqual([one.silent, one.last_vehicle_at], [true, "2026-10-21T06:56:00.000Z"]);
  // une autre voie du même sens a vu passer un véhicule : le compteur n'est pas muet
  assert.equal(counterReading(["T.01", "T.02"], counterWindow(rows, { last_vehicle, silent_before })).silent, false);
  // relevés interrompus (pas de seuil) : on ne conclut pas
  assert.equal(counterReading(["T.01"], counterWindow(rows, { last_vehicle })).silent, false);
});
