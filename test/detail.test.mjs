// Fiche d'un point (maquette 5a) : regroupement des sens, ordre de gravité, données manquantes masquées,
// annonce de fermeture, alternative et réouverture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { alternativeOf, nextClosure, reopeningText, statusLines } from "../src/lib/detail.js";

const NOW = Date.parse("2026-10-29T10:00:00.000Z"); // 11:00 à Zurich

const dir = (label, level = "clear", extra = {}) => ({ label, level, queue_km: null, delay_min: null, delay_estimate: null, since: null, messages: [], ...extra });
const point = (over = {}) => ({
  id: "col-du-grand-st-bernard",
  name: "Col du Grand-Saint-Bernard",
  type: "col",
  level: "clear",
  directions: { a: dir("Vers l'Italie"), b: dir("Vers Martigny") },
  undirected: [],
  upcoming: [],
  ...over,
});
const winter = { level: "closed", reason_fr: "fermeture hivernale", section_fr: "entre le col et St-Oyen", start: "2026-10-19T06:00:00.000Z", end: null, text_fr: "" };

test("deux sens au même statut : une seule ligne", () => {
  const lines = statusLines(point(), NOW);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].title, "Pas d'alerte");
  assert.equal(lines[0].text, "Aucun message de l'OFROU");
});

test("sens différents : une ligne par sens, la plus grave d'abord, cause et début", () => {
  const c = point({ level: "closed", directions: { a: dir("Vers Martigny"), b: dir("Vers l'Italie", "closed", { messages: [winter] }) } });
  const lines = statusLines(c, NOW);
  assert.deepEqual(
    lines.map((l) => [l.title, l.text, l.barrier]),
    [
      ["Fermé vers l'Italie", "Fermeture hivernale, depuis le 19 octobre", true],
      ["Pas d'alerte vers Martigny", "Aucun message de l'OFROU", false],
    ],
  );
});

test("bouchon : métriques connues seulement", () => {
  const c = point({ type: "axe", level: "jam", directions: { a: dir("Vers le Valais", "jam", { queue_km: 3.5, since: "2026-10-29T09:30:00.000Z" }), b: dir("Vers Lausanne") } });
  const [jam] = statusLines(c, NOW);
  assert.equal(jam.text, "Depuis 10:30");
  assert.deepEqual(jam.metrics, [{ value: "3,5 km", label: "de bouchon" }]);
});

test("fermeture annoncée : ce soir, fin de la nuit, période, déviation ; jonction annoncée comme telle", () => {
  const nightly = { situation_id: "s1", level: "detour", next_start: "2026-10-29T19:00:00.000Z", end: "2026-11-06T04:00:00.000Z", schedule: { kind: "night", from: "20:00", to: "05:00" }, roadworks: true, reason_fr: null, text_fr: "Recommandation: une déviation locale est en place" };
  assert.deepEqual(nextClosure(point({ upcoming: [nightly] }), NOW), {
    title: "Ferme ce soir à 20:00",
    text: "Jusqu'à 05:00, chaque nuit jusqu'au 06.11 · travaux · déviation locale",
  });
  const access = { situation_id: "s2", level: "access", next_start: "2026-10-30T23:30:00.000Z", end: "2026-10-31T04:00:00.000Z", schedule: null, roadworks: false, reason_fr: null, text_fr: "" };
  assert.equal(nextClosure(point({ upcoming: [access] }), NOW).title, "Jonction fermée le 31.10 à 00:30");
  assert.equal(nextClosure(point(), NOW), null);
});

test("point fermé : alternative si elle est ouverte ; réouverture seulement si toutes les fins sont connues", () => {
  const c = point({ level: "closed", directions: { a: dir("Vers l'Italie", "closed", { messages: [winter] }), b: dir("Vers Martigny") } });
  const tunnel = { id: "grand-st-bernard", name: "Tunnel du Grand-Saint-Bernard", level: "clear" };
  assert.deepEqual(alternativeOf(c, [c, tunnel]), { title: "Passez par le tunnel du Grand-Saint-Bernard", text: "Tunnel du Grand-Saint-Bernard · Pas d'alerte" });
  assert.equal(alternativeOf(c, [c, { ...tunnel, level: "closed" }]), null);

  assert.equal(reopeningText(c, NOW), null);
  const ending = point({ level: "closed", directions: { a: dir("Vers l'Italie", "closed", { messages: [{ ...winter, end: "2026-10-30T06:00:00.000Z" }] }), b: dir("Vers Martigny") } });
  assert.equal(reopeningText(ending, NOW), "Réouverture prévue le 30.10 à 07:00");
});

test("chantier publié des mois à l'avance : pas annoncé dans la fiche (date sans année) ; début d'une autre année daté", () => {
  const far = { situation_id: "s3", level: "closed", next_start: "2027-05-10T20:00:00.000Z", end: "2027-05-11T03:00:00.000Z", schedule: null, roadworks: true, reason_fr: null, text_fr: "" };
  assert.equal(nextClosure(point({ upcoming: [far] }), NOW), null);
  const inSixDays = { ...far, next_start: "2026-11-04T20:00:00.000Z", end: "2026-11-05T03:00:00.000Z" };
  assert.equal(nextClosure(point({ upcoming: [far, inSixDays] }), NOW).title, "Ferme le 04.11 à 21:00");
  const old = { ...winter, level: "jam", start: "2021-06-25T03:00:00.000Z" };
  const [line] = statusLines(point({ level: "jam", directions: { a: dir("Vers l'Italie", "jam", { messages: [old] }), b: dir("Vers Martigny", "jam", { messages: [old] }) } }), NOW);
  assert.equal(line.text, "Fermeture hivernale dans les deux sens, depuis le 25 juin 2021");
});
