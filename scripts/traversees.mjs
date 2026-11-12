#!/usr/bin/env node
/**
 * Exploration en ligne de commande (même logique que le serveur).
 *
 *   npm run traversees                          # état des points suivis + messages retenus
 *   npm run traversees -- --json                # une ligne JSON par situation retenue
 *   npm run traversees -- --all                 # tout le flux
 *   npm run traversees -- --dump data/raw.xml   # sauve aussi le XML brut
 *   npm run traversees -- --file data/raw.xml   # rejoue un XML sauvé, sans appel réseau
 *   npm run traversees -- --at 2026-10-08T20:00:00Z   # heure de référence (rejeu)
 *
 * Appel réel : à espacer d'au moins 2 min, y compris avec le serveur qui tourne (il appelle déjà toutes les 3 min).
 */
import { readFile, writeFile } from "node:fs/promises";
import { fetchTrafficSituationsXml } from "../lib/otd-client.mjs";
import { parseTrafficXml } from "../lib/datex.mjs";
import { crossingRefs, summarizeAll } from "../lib/crossings.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

try {
  const xml = opt("--file")
    ? await readFile(opt("--file"), "utf8")
    : await fetchTrafficSituationsXml({ apiKey: process.env.OTD_API_KEY });
  if (opt("--dump")) await writeFile(opt("--dump"), xml);

  const now = opt("--at") ? new Date(opt("--at")).toISOString() : new Date().toISOString();
  const { publication_time, situations } = parseTrafficXml(xml, { fetchedAt: now });
  const selected = flag("--all")
    ? situations.map((s) => ({ ...s, crossings: crossingRefs(s) }))
    : situations.map((s) => ({ ...s, crossings: crossingRefs(s) })).filter((s) => s.crossings.length);

  if (flag("--json")) {
    for (const s of selected) console.log(JSON.stringify(s));
  } else {
    console.log(`Flux publié : ${publication_time} — ${situations.length} situations, ${selected.length} retenues — référence ${now}\n`);
    for (const s of selected) {
      const refs = s.crossings.map((r) => `${r.id}/${r.dir ?? "?"}`).join(" ") || "—";
      const jam = [s.queue_km != null && `${s.queue_km} km`, s.delay_min != null && `${s.delay_min} min perdues`].filter(Boolean).join(", ");
      const sched = s.schedule ? ` · ${s.schedule.kind} ${s.schedule.from}–${s.schedule.to}` : "";
      console.log(`• [${s.condition}${s.roadworks ? " · travaux" : ""}] ${refs} ${jam}${s.status === "cancelled" ? " (levé)" : ""}`);
      console.log(`  ${s.text_fr || s.text_de || s.text_it || "(pas de texte)"}`);
      console.log(`  ${s.start ?? "?"}${s.end ? ` → ${s.end}` : ""}${sched} · ${s.situation_id} v${s.version}\n`);
    }
    for (const c of summarizeAll(situations, now)) {
      const dirs = Object.values(c.directions)
        .map((x) => `${x.arrow} ${x.level}${x.queue_km != null ? ` ${x.queue_km} km` : ""}`)
        .join(" · ");
      const next = c.upcoming[0] ? ` · prochaine fermeture ${c.upcoming[0].next_start}` : "";
      console.log(`${c.name.padEnd(30)} ${c.level.padEnd(8)} ${dirs}${next}`);
    }
  }
} catch (e) {
  console.error(`${e.code ?? e.name} : ${e.message}`);
  process.exit(1);
}
