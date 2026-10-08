#!/usr/bin/env node
/**
 * Exploration en ligne de commande (même logique que le serveur).
 *
 *   npm run gothard                        # messages Gothard, lisible
 *   npm run gothard -- --json              # une ligne JSON par situation
 *   npm run gothard -- --all               # tout le flux
 *   npm run gothard -- --dump data/raw.xml # sauve aussi le XML brut
 *   npm run gothard -- --file data/raw.xml # rejoue un XML sauvé, sans appel réseau
 *
 * Appel réel : à espacer d'au moins 2 min, y compris avec le serveur qui tourne (il appelle déjà toutes les 3 min).
 */
import { readFile, writeFile } from "node:fs/promises";
import { fetchTrafficSituationsXml } from "../lib/otd-client.mjs";
import { parseTrafficXml, gothardSummary } from "../lib/datex.mjs";

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

  const now = new Date().toISOString();
  const { publication_time, situations } = parseTrafficXml(xml, { fetchedAt: now });
  const selected = flag("--all") ? situations : situations.filter((s) => s.is_gothard);

  if (flag("--json")) {
    for (const s of selected) console.log(JSON.stringify(s));
  } else {
    console.log(`Flux publié : ${publication_time} — ${situations.length} situations, ${selected.length} retenues\n`);
    for (const s of selected) {
      const jam = [s.queue_km != null && `${s.queue_km} km`, s.delay_min != null && `${s.delay_min} min perdues`]
        .filter(Boolean)
        .join(", ");
      console.log(`• [${s.types.join("+")}${s.jam ? ` / ${s.jam}` : ""}] ${s.direction ?? "?"} ${jam || "—"}${s.status === "cancelled" ? " (levé)" : ""}`);
      console.log(`  ${s.text_fr || s.text_de || s.text_it || "(pas de texte)"}`);
      console.log(`  ${s.start ?? "?"}${s.end ? ` → ${s.end}` : ""} · ${s.situation_id} v${s.version}\n`);
    }
    const sum = gothardSummary(situations, now);
    console.log(`Gothard nord→sud : ${sum["N-S"].queue_km} km · sud→nord : ${sum["S-N"].queue_km} km · ${sum.alerts.length} autre(s) message(s)`);
  }
} catch (e) {
  console.error(`${e.code ?? e.name} : ${e.message}`);
  process.exit(1);
}
