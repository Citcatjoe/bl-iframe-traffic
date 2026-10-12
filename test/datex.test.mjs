// Extraits réels du flux OFROU du 08.10.2026 (test/fixtures/sample.xml) : formulations et champs effectivement émis.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTrafficXml, isInEffect, DatexParseError } from "../lib/datex.mjs";

const xml = readFileSync(new URL("./fixtures/sample.xml", import.meta.url), "utf8");
const { situations, publication_time } = parseTrafficXml(xml, { fetchedAt: "2026-10-08T13:45:00.000Z" });
const byId = Object.fromEntries(situations.map((s) => [s.situation_id.replace(/^situation\.|\.1$/g, ""), s]));

test("une entrée par situation, textes trilingues de la description", () => {
  assert.equal(publication_time, "2026-10-08T13:44:31.912Z");
  assert.equal(situations.length, 12);
  assert.match(byId["658214"].text_fr, /^Libéré: A2 Lucerne -> St-Gothard entre .*Amsteg/);
  assert.ok(byId["658214"].text_de && byId["658214"].text_it);
});

test("en-tête : route, extrémités, flèche et lieu", () => {
  const s = byId["658214"];
  assert.deepEqual([s.road, s.route_from, s.route_arrow, s.route_to], ["A2", "Luzern", "->", "Gotthard"]);
  assert.equal(s.location_de, "zwischen Anschluss Amsteg und Anschluss Göschenen");
  // extrémité de plusieurs mots
  assert.deepEqual([byId["651708"].route_from, byId["651708"].route_to], ["Bellinzona", "S. Bernardino"]);
});

test("nature de la situation lue dans « Sachlage »", () => {
  assert.equal(byId["658214"].condition, "jam");
  assert.equal(byId["658248"].condition, "slow"); // stockender Verkehr
  assert.equal(byId["658268"].condition, "closed"); // Tunnel gesperrt, pas de déviation
  assert.equal(byId["651708"].condition, "closed_detour"); // "eine lokale Umleitung ist eingerichtet"
  assert.equal(byId["655961"].condition, "closed");
  assert.equal(byId["658281"].condition, "jam_expected"); // Stau zu erwarten
  assert.equal(byId["287191"].condition, "hindrance");
  assert.equal(byId["287191"].roadworks, true);
});

test("longueur de bouchon et temps perdu", () => {
  assert.equal(byId["658214"].queue_km, 4);
  assert.equal(byId["658215"].queue_km, 5);
  assert.equal(byId["658270"].delay_min, 45);
  // longueur de chantier ("Länge [km] 0.3") ≠ bouchon
  assert.equal(byId["287191"].queue_km, null);
});

test("message levé (Aufgehoben) et fenêtre de validité effective", () => {
  assert.equal(byId["658248"].status, "cancelled");
  assert.equal(byId["658222"].start, "2026-10-08T16:00:00.000Z"); // saisi à 09:44Z, fermeture 18:00 locale
  assert.equal(isInEffect(byId["658248"], "2026-10-08T13:45:00.000Z"), false);
  assert.equal(isInEffect(byId["658222"], "2026-10-08T13:45:00.000Z"), false);
  assert.equal(isInEffect(byId["658222"], "2026-10-08T16:30:00.000Z"), true);
});

test("fermeture nocturne : en vigueur la nuit seulement, heure suisse", () => {
  const s = byId["651708"]; // nachts 11.10.2026 22:00 bis 16.10.2026 05:00
  assert.deepEqual(s.schedule, { kind: "night", from: "22:00", to: "05:00" });
  assert.equal(isInEffect(s, "2026-10-12T10:00:00.000Z"), false); // 12:00 locale
  assert.equal(isInEffect(s, "2026-10-12T20:30:00.000Z"), true); // 22:30 locale
  assert.equal(isInEffect(s, "2026-10-13T02:59:00.000Z"), true); // 04:59 locale
  assert.equal(isInEffect(s, "2026-10-13T03:00:00.000Z"), false); // 05:00 locale
  assert.equal(isInEffect(s, "2026-10-16T20:30:00.000Z"), false); // après la dernière nuit
});

test("réponses inattendues", () => {
  assert.throws(() => parseTrafficXml(""), DatexParseError);
  assert.throws(() => parseTrafficXml("<html>Service Unavailable</html>"), DatexParseError);
  assert.throws(
    () =>
      parseTrafficXml(
        `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultstring>Bad</faultstring></soap:Fault></soap:Body></soap:Envelope>`,
      ),
    /SOAP Fault : Bad/,
  );
});
