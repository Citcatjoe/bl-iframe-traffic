// Sélection des points du mode compact (`?points=`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { selectPoints } from "../src/lib/filters.js";

const all = ["gothard", "lausanne-geneve", "lausanne-valais", "douane-bardonnex", "douane-vallorbe"].map((id) => ({ id }));
const ids = (r) => r.list.map((c) => c.id);

test("sans paramètre (ou vide) : tous les points", () => {
  assert.deepEqual(ids(selectPoints(all, null)), all.map((c) => c.id));
  assert.deepEqual(ids(selectPoints(all, " , ")), all.map((c) => c.id));
});

test("sélection : points demandés seulement, espaces tolérés, inconnus signalés ; une seule colonne sans `|`", () => {
  const r = selectPoints(all, "douane-vallorbe, lausanne-geneve,col-inconnu");
  assert.deepEqual(ids(r), ["douane-vallorbe", "lausanne-geneve"]);
  assert.equal(r.columns, null);
  assert.deepEqual(r.unknown, ["col-inconnu"]);
});

test("`|` : une colonne par groupe ; un groupe vidé par des inconnus disparaît", () => {
  const r = selectPoints(all, "lausanne-geneve,lausanne-valais|douane-bardonnex,douane-vallorbe");
  assert.deepEqual(r.columns.map((g) => g.map((c) => c.id)), [["lausanne-geneve", "lausanne-valais"], ["douane-bardonnex", "douane-vallorbe"]]);
  assert.equal(selectPoints(all, "gothard|inconnu").columns, null);
});
