// Journal de la fiche : changements d'état par sens, regroupés quand ils sont identiques dans les deux sens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { journalEvents } from "../src/lib/journal.js";

const p = (t, dir, level, queue_km = null, section_fr = null) => ({ t: `2026-10-27T${t}:00.000Z`, dir, level, queue_km, section_fr });

test("un événement par changement de niveau, du plus récent au plus ancien ; deux sens identiques regroupés", () => {
  const events = journalEvents([
    p("10:00", "a", "clear"), p("10:00", "b", "clear"),
    p("10:03", "a", "jam", 2), p("10:03", "b", "clear"),
    p("10:06", "a", "jam", 4), p("10:06", "b", "clear"), // longueur qui change : pas un nouvel événement
    p("10:09", "a", "clear"), p("10:09", "b", "clear"),
    p("22:00", "a", "closed", null, "entre Montreux et Villeneuve"), p("22:00", "b", "closed", null, "entre Montreux et Villeneuve"),
  ]);
  assert.deepEqual(
    events.map((e) => [e.t.slice(11, 16), e.dirs.join(""), e.level, e.queue_km]),
    [["22:00", "ab", "closed", null], ["10:09", "a", "clear", null], ["10:03", "a", "jam", 2]],
  );
  // Fin d'alerte : niveau quitté et durée, mesurée depuis son début.
  assert.deepEqual([events[1].prev, events[1].lasted_ms], ["jam", 6 * 60_000]);
});

test("fin d'un état déjà en cours au premier relevé : durée inconnue", () => {
  const [end] = journalEvents([p("08:00", "a", "closed"), p("08:30", "a", "clear")]);
  assert.deepEqual([end.level, end.prev, end.lasted_ms], ["clear", "closed", null]);
});

test("état déjà en cours au premier relevé : marqué initial ; rien si tout est calme", () => {
  const events = journalEvents([p("08:00", "a", "closed"), p("08:00", "b", "clear"), p("08:03", "a", "closed"), p("08:03", "b", "clear")]);
  assert.deepEqual(events.map((e) => [e.dirs.join(""), e.level, e.initial]), [["a", "closed", true]]);
  assert.deepEqual(journalEvents([p("08:00", "a", "clear"), p("08:03", "a", "clear")]), []);
});
