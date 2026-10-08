import { DIRECTIONS, cleanText, duration, km, when } from "../format.js";

export default function DirectionCard({ direction, stats }) {
  const { label, sub } = DIRECTIONS[direction];
  const main = stats.jams[0];

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900">{label}</h2>
        <span className="text-xs text-stone-500">{sub}</span>
      </header>

      {main ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-3xl font-bold tabular-nums text-red-700">
              {main.queue_km != null ? `${km(stats.queue_km)} km` : "Bouchon"}
              {main.queue_km != null && <span className="ml-1 text-sm font-medium text-stone-600">de bouchon</span>}
            </p>
            <p className="text-sm text-stone-700">
              {stats.delay_min != null ? (
                <>
                  <span className="font-semibold tabular-nums">{duration(stats.delay_min)}</span> de temps perdu
                </>
              ) : (
                <span className="text-stone-500">Temps perdu non communiqué</span>
              )}
            </p>
          </div>
          <p className="mt-3 text-sm leading-snug text-stone-800">{cleanText(main.text_fr ?? main.text_de)}</p>
          {stats.jams.length > 1 && (
            <p className="mt-1 text-xs text-stone-500">+ {stats.jams.length - 1} autre(s) message(s) de bouchon dans ce sens</p>
          )}
          <p className="mt-3 text-xs text-stone-500">Mis à jour : {when(main.version_time)}</p>
        </>
      ) : (
        <p className="py-3 text-lg font-medium text-emerald-700">Pas de bouchon signalé</p>
      )}
    </section>
  );
}
