// Extraits réels du flux OFROU du 08.10.2026 (test/fixtures/sample.xml) : formulations et champs effectivement émis.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTrafficXml, gothardSummary, DatexParseError } from "../lib/datex.mjs";

const xml = readFileSync(new URL("./fixtures/sample.xml", import.meta.url), "utf8");
const { situations, publication_time } = parseTrafficXml(xml, { fetchedAt: "2026-10-08T13:45:00.000Z" });
const byId = Object.fromEntries(situations.map((s) => [s.situation_id.replace(/^situation\.|\.1$/g, ""), s]));

test("une entrée par situation, textes trilingues de la description", () => {
  assert.equal(publication_time, "2026-10-08T13:44:31.912Z");
  assert.equal(situations.length, 8);
  assert.match(byId["658214"].text_fr, /^Libéré: A2 Lucerne -> St-Gothard entre .*Amsteg/);
  assert.ok(byId["658214"].text_de && byId["658214"].text_it);
});

test("filtre Gothard sur le lieu, pas sur l'extrémité d'itinéraire", () => {
  assert.equal(byId["658214"].is_gothard, true); // Amsteg – Göschenen
  assert.equal(byId["287191"].is_gothard, true); // Tunnel Gotthard-Tunnel
  assert.equal(byId["658270"].is_gothard, false); // A2 Basel -> Luzern, Augst – Sissach
  assert.equal(byId["613971"].is_gothard, false); // H11 Meiringen <-> Wassen (Susten) : Wassen n'est qu'une extrémité
});

test("sens déduit de l'itinéraire A2", () => {
  assert.equal(byId["658214"].direction, "N-S"); // Luzern -> Gotthard
  assert.equal(byId["658215"].direction, "S-N"); // Chiasso -> Gotthard
  assert.equal(byId["658268"].direction, "both"); // Chiasso <-> Gotthard
  assert.equal(byId["658270"].direction, "N-S"); // Basel -> Luzern
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
});

test("résumé widget par sens", () => {
  const sum = gothardSummary(situations, "2026-10-08T13:45:00.000Z");
  assert.deepEqual(
    [sum["N-S"].queue_km, sum["S-N"].queue_km],
    [4, 5],
  );
  // tunnel fermé : alerte en cours ; fermeture H2 de 18:00 : pas encore ; chantier : jamais
  assert.deepEqual(sum.alerts.map((s) => s.situation_id), ["situation.658268.1"]);
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
