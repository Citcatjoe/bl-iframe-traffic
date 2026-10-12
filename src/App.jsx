import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrossingDock, CrossingStrip } from "./components/CrossingDetail.jsx";
import DebugFeed from "./components/DebugFeed.jsx";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { MapView } from "./components/MapView";
import { SidePanel } from "./components/SidePanel";
import { levelRank } from "./format.js";
import { HEIGHT, MAX_WIDTH, modeFor, useWidth } from "./hooks/useWidth";
import { usePolling } from "./usePolling.js";

const NOW_REFRESH_MS = 60_000; // lit le cache du serveur, n'appelle jamais l'API OFROU
const params = new URLSearchParams(window.location.search);
const POINT = params.get("point");
const DEBUG = params.get("debug") === "1";

/** Tri par gravité (ordre de format.js), puis ordre fixe de l'API. */
const bySeverity = (list) => list.map((c, i) => [c, i]).sort((a, b) => levelRank(a[0].level) - levelRank(b[0].level) || a[1] - b[1]).map(([c]) => c);

export default function App() {
  const rootRef = useRef(null);
  const width = useWidth(rootRef);
  const mode = modeFor(width);
  const now = usePolling("/api/now", NOW_REFRESH_MS);
  const d = now.data;
  const crossings = useMemo(() => d?.crossings ?? [], [d]);
  const list = useMemo(() => bySeverity(crossings), [crossings]);
  const status = now.error ? "error" : d ? "ok" : "loading";

  const [sel, setSel] = useState(null);
  // Dernière traversée affichée : la fiche reste remplie pendant le glissement de retour.
  const [shownId, setShownId] = useState(null);
  const [hover, setHover] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const select = useCallback(
    (id) => {
      setSel(id);
      setShownId(id);
      setHover(null);
      setPanelOpen(mode === "mid");
      document.activeElement?.blur?.();
    },
    [mode],
  );

  // ?point=<id> : présélection au premier chargement
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !d || !POINT) return;
    preselected.current = true;
    if (d.crossings.some((c) => c.id === POINT)) select(POINT);
    else console.warn(`?point=${POINT} inconnu (valeurs : ${d.crossings.map((c) => c.id).join(", ")})`);
  }, [d, select]);

  const back = useCallback(() => {
    setSel(null);
    if (mode === "mobile") setPanelOpen(false);
  }, [mode]);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setSel(null);
  }, []);

  const find = (id) => crossings.find((c) => c.id === id) ?? null;
  const shown = shownId ? find(shownId) : null;
  const selected = sel ? find(sel) : null;
  const mobile = mode === "mobile";

  return (
    <>
      <div
        ref={rootRef}
        className="relative mx-auto flex w-full flex-col overflow-hidden bg-surface font-body text-ink"
        style={{ height: HEIGHT[mode], maxWidth: MAX_WIDTH }}
      >
        <Header mode={mode} status={status} time={d?.fetched_at} />
        {now.error && d && (
          <p role="alert" className="m-0 flex-none bg-surface-weak px-4 py-1 text-[11.5px] text-ink-weak">
            {now.error} Dernières données affichées.
          </p>
        )}
        <div className={`relative flex min-h-0 flex-1 ${mobile ? "flex-col" : "flex-row"}`}>
          <SidePanel
            mode={mode}
            panelOpen={panelOpen}
            list={list}
            sel={sel}
            shown={shown}
            countersKnown={!!d?.counters_at}
            onSelect={select}
            onHover={setHover}
            onClose={closePanel}
            onBack={back}
          />
          <MapView
            crossings={crossings}
            sel={sel}
            hover={hover}
            mode={mode}
            width={width}
            onHover={setHover}
            onSelect={select}
            listToggle={mode === "mid" && !panelOpen ? { label: `Liste · ${list.length}`, onClick: openPanel } : null}
          />
          {mobile && selected && <CrossingDock c={selected} onClose={() => setSel(null)} onDetails={openPanel} />}
          {mobile && !selected && list.length > 0 && <CrossingStrip crossings={list} onSelect={select} onOpen={openPanel} />}
          {mobile && !d && (
            <p className="order-3 m-0 flex h-[168px] flex-none items-center justify-center border-t border-line text-sm text-ink-weak">
              {now.error ?? "Chargement…"}
            </p>
          )}
        </div>
        <Footer mode={mode} />
      </div>
      {DEBUG && (
        <section className="mx-auto mt-4 max-w-[964px] px-3">
          <DebugFeed point={sel} />
        </section>
      )}
    </>
  );
}
