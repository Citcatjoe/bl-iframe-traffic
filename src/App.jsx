import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CompactView } from "./components/CompactView.jsx";
import { apiUrl } from "./config/api.js";
import DebugFeed from "./components/DebugFeed.jsx";
import { Footer } from "./components/Footer";
import { HEADER_NARROW_MAX, Header } from "./components/Header";
import { MapView } from "./components/MapView";
import { SidePanel } from "./components/SidePanel";
import { trackClick, trackImpression } from "./lib/analytics.js";
import { applyFilter, selectPoints } from "./lib/filters.js";
import { useTheme } from "./lib/theme.js";
import { HEIGHT, MAX_WIDTH, modeFor, useWidth } from "./hooks/useWidth";
import { usePolling } from "./usePolling.js";

// Relecture 5 à 30 s après le prochain relevé prévu par le serveur (situations et compteurs), étalée pour que
// tous les lecteurs n'arrivent pas à la même seconde. Repli et nouvelle tentative : toutes les 60 s.
const NOW_RETRY_MS = 60_000;
function afterNextPoll(d) {
  const times = [d?.poller?.situations?.next_poll, d?.poller?.counters?.next_poll].map(Date.parse).filter(Number.isFinite);
  return times.length ? Math.max(...times) + 5_000 + Math.random() * 25_000 : null;
}
const params = new URLSearchParams(window.location.search);
const POINT = params.get("point");
const DEBUG = params.get("debug") === "1";
// ?mode=compact : quelques lignes sans carte (haut de rubrique, homepage) ; ?mode=explore (défaut) : carte + panneau
// (dans un article). Ne pas confondre avec `mode` dans le code : la mise en page (wide / mid / mobile) selon la largeur.
const COMPACT = params.get("mode") === "compact";
// Lien « Tout voir » du mode compact (article contenant le mode explore) ; sans paramètre, pas de lien.
const SEE_ALL_URL = params.get("seeAllUrl");
// Points affichés par le mode compact : `?points=douane-bardonnex,lausanne-geneve,…` ; absent : tous les points.
const POINTS = params.get("points");
if (params.has("mode") && !["compact", "explore"].includes(params.get("mode"))) {
  console.warn(`?mode=${params.get("mode")} inconnu (valeurs : explore, compact) : mode explore.`);
}

export default function App() {
  const rootRef = useRef(null);
  const width = useWidth(rootRef);
  const mode = modeFor(width);
  // Clair / sombre : l'interface suit seule (variables de base.css) ; la carte a besoin du thème en JS.
  const theme = useTheme();
  const now = usePolling(apiUrl("/api/now"), NOW_RETRY_MS, afterNextPoll);
  const d = now.data;
  const crossings = useMemo(() => d?.crossings ?? [], [d]);
  // Mode compact : sélection de `?points=` (identifiants inconnus signalés une fois, dès les premières données).
  const compactSel = useMemo(() => selectPoints(crossings, POINTS), [crossings]);
  const warned = useRef(false);
  useEffect(() => {
    if (warned.current || !d || !compactSel.unknown.length) return;
    warned.current = true;
    console.warn(`?points= : ${compactSel.unknown.join(", ")} inconnu(s) (valeurs : ${crossings.map((c) => c.id).join(", ")})`);
  }, [d, compactSel, crossings]);
  // Filtre du mode explore (null : tout afficher) : appliqué à la liste et à la carte.
  const [filter, setFilter] = useState(null);
  const visible = useMemo(() => applyFilter(crossings, filter), [crossings, filter]);
  const status = now.error ? "error" : d ? "ok" : "loading";

  const [sel, setSel] = useState(null);
  // Dernier point affiché : la fiche reste remplie pendant le glissement de retour.
  const [shownId, setShownId] = useState(null);
  const [hover, setHover] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const select = useCallback(
    (id) => {
      setSel(id);
      setShownId(id);
      setHover(null);
      // La fiche s'ouvre dans le panneau (superposé à la carte, ou plein cadre en mobile).
      setPanelOpen(true);
      document.activeElement?.blur?.();
    },
    [],
  );

  // ?point=<id> : présélection au premier chargement
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !d || !POINT) return;
    preselected.current = true;
    if (d.crossings.some((c) => c.id === POINT)) select(POINT);
    else console.warn(`?point=${POINT} inconnu (valeurs : ${d.crossings.map((c) => c.id).join(", ")})`);
  }, [d, select]);

  // Retour de la fiche à la liste, panneau ouvert (mobile compris).
  const back = useCallback(() => setSel(null), []);
  const openPanel = useCallback(() => {
    setPanelOpen(true);
    trackClick("list");
  }, []);

  // Suivi d'audience : l'affichage, puis les actions de l'utilisateur (pas la présélection ?point=).
  useEffect(() => trackImpression(), []);
  const selectFrom = useCallback(
    (source) => (id) => {
      trackClick("point", { point: id, source });
      select(id);
    },
    [select],
  );
  const selectFromList = useMemo(() => selectFrom("list"), [selectFrom]);
  const selectFromMap = useMemo(() => selectFrom("map"), [selectFrom]);
  const changeFilter = useCallback((id) => {
    setFilter(id);
    trackClick("filter", { filter: id ?? "all" });
  }, []);
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setSel(null);
  }, []);

  const find = (id) => crossings.find((c) => c.id === id) ?? null;
  const shown = shownId ? find(shownId) : null;
  const mobile = mode === "mobile";
  const staleBanner = now.error && d && (
    <p role="alert" className="m-0 flex-none bg-surface-weak px-4 py-1 text-[11.5px] text-ink-weak">
      {now.error} Dernières données affichées.
    </p>
  );

  const narrow = width < HEADER_NARROW_MAX;

  // Hauteur selon le contenu : ajustée par iframeHeightAdjustment.js, comme pour le mode explore. Ni cadre, ni
  // arrondi, ni marge extérieure ; fonds gris et retrait intérieur pour que les bords du widget se lisent dans l'article.
  if (COMPACT) {
    return (
      <div ref={rootRef} className="relative mx-auto flex w-full flex-col overflow-hidden bg-surface font-body text-ink" style={{ maxWidth: MAX_WIDTH }}>
        <Header narrow={narrow} status={status} time={d?.fetched_at} compact />
        {staleBanner}
        <CompactView crossings={compactSel.list} columns={compactSel.columns} twoColumns={!narrow} error={now.error} seeAllUrl={SEE_ALL_URL} />
      </div>
    );
  }
  return (
    <>
      <div
        ref={rootRef}
        className="relative mx-auto flex w-full flex-col overflow-hidden bg-surface font-body text-ink"
        style={{ height: HEIGHT[mode], maxWidth: MAX_WIDTH }}
      >
        <Header narrow={narrow} status={status} time={d?.fetched_at} />
        {staleBanner}
        <div className={`relative flex min-h-0 flex-1 ${mobile ? "flex-col" : "flex-row"}`}>
          <SidePanel
            mode={mode}
            panelOpen={panelOpen}
            crossings={crossings}
            updatedAt={d?.fetched_at}
            list={visible}
            filter={filter}
            onFilter={changeFilter}
            sel={sel}
            shown={shown}
            onSelect={selectFromList}
            onHover={setHover}
            onOpen={openPanel}
            onClose={closePanel}
            onBack={back}
          />
          <MapView
            crossings={visible}
            sel={sel}
            hover={hover}
            mode={mode}
            width={width}
            theme={theme}
            onHover={setHover}
            onSelect={selectFromMap}
            listToggle={!mobile && !panelOpen ? { label: `Liste · ${visible.length}`, onClick: openPanel } : null}
          />
        </div>
        <Footer />
      </div>
      {DEBUG && (
        <section className="mx-auto mt-4 max-w-[964px] px-3">
          <DebugFeed point={sel} />
        </section>
      )}
    </>
  );
}
