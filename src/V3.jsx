import { useState, useEffect, useRef, useCallback } from "react";

const GENERATIONS = [
  { label: "Toutes", value: 0, range: [1, 1025] },
  { label: "Gen I", value: 1, range: [1, 151] },
  { label: "Gen II", value: 2, range: [152, 251] },
  { label: "Gen III", value: 3, range: [252, 386] },
  { label: "Gen IV", value: 4, range: [387, 493] },
  { label: "Gen V", value: 5, range: [494, 649] },
  { label: "Gen VI", value: 6, range: [650, 721] },
  { label: "Gen VII", value: 7, range: [722, 809] },
  { label: "Gen VIII", value: 8, range: [810, 905] },
  { label: "Gen IX", value: 9, range: [906, 1025] },
];

function spriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function buildRange(gen) {
  const [start, end] = gen.range;
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

async function fetchFrenchName(id) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    const fr = data.names.find((n) => n.language.name === "fr");
    return fr ? fr.name : null;
  } catch { return null; }
}

async function exportImage(selected, allPokemon) {
  const list = [...selected]
    .map((id) => allPokemon[id])
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);
  if (!list.length) return;

  const W = 720;
  const HEADER_H = 100;
  const FOOTER_H = 60;
  const PADDING = 24;
  const COLS = 4;
  const CELL = Math.floor((W - PADDING * 2) / COLS);
  const SPRITE = 120;
  const CELL_H = SPRITE + 44;
  const ROWS = Math.ceil(list.length / COLS);
  const GRID_H = ROWS * CELL_H + PADDING;
  const H = Math.max(1280, HEADER_H + GRID_H + FOOTER_H + PADDING * 2);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#F8F7F4";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#FF6B00";
  ctx.fillRect(0, 0, W, HEADER_H);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Poké", 32, 58);
  ctx.fillStyle = "#FFD599";
  const pokeWidth = ctx.measureText("Poké").width;
  ctx.fillText("List", 32 + pokeWidth, 58);

  ctx.fillStyle = "#fff";
  ctx.font = "18px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${list.length} Pokémon`, W - 32, 58);

  const loadImg = (url) => new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
  const images = await Promise.all(list.map((p) => loadImg(spriteUrl(p.id))));

  list.forEach((pokemon, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PADDING + col * CELL;
    const y = HEADER_H + PADDING + row * CELL_H;

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, CELL - 8, CELL_H - 6, 12);
    ctx.fill();

    const img = images[i];
    if (img) {
      ctx.drawImage(img, x + (CELL - SPRITE) / 2, y + 8, SPRITE, SPRITE);
    }

    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    const name = pokemon.frName || pokemon.name;
    const displayName = name.length > 10 ? name.slice(0, 9) + "…" : name;
    ctx.fillText(displayName, x + CELL / 2, y + SPRITE + 22);

    ctx.fillStyle = "#999";
    ctx.font = "11px monospace";
    ctx.fillText(`#${String(pokemon.id).padStart(3, "0")}`, x + CELL / 2, y + SPRITE + 38);
  });

  ctx.fillStyle = "#eee";
  ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
  ctx.fillStyle = "#999";
  ctx.font = "14px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Créé avec PokéList", W / 2, H - FOOTER_H + 36);

  const link = document.createElement("a");
  link.download = `pokeliste-${list.length}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function PokeCard({ pokemon, selected, onToggle }) {
  return (
    <button
      onClick={() => onToggle(pokemon.id)}
      className={`
        relative flex flex-col items-center gap-0.5 p-1.5 rounded-2xl
        transition-all duration-150 cursor-pointer border-2 w-full
        ${selected
          ? "border-orange-400 bg-orange-50 shadow-md shadow-orange-100"
          : "border-transparent bg-white hover:border-gray-200 hover:shadow-sm"
        }
      `}
    >
      {selected && (
        <span className="absolute top-1.5 right-1.5 bg-orange-400 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
          ✓
        </span>
      )}
      <img
        src={spriteUrl(pokemon.id)}
        alt={pokemon.frName || pokemon.name}
        width={56}
        height={56}
        loading="lazy"
        className="w-12 h-12 object-contain"
      />
      <span className={`text-[10px] font-semibold truncate w-full text-center leading-tight ${selected ? "text-orange-700" : "text-gray-700"}`}>
        {pokemon.frName || pokemon.name}
      </span>
      <span className="text-[8px] text-gray-400 font-mono">
        #{String(pokemon.id).padStart(3, "0")}
      </span>
    </button>
  );
}

export default function App() {
  const [gen, setGen] = useState(1);
  const [search, setSearch] = useState("");
  const [allPokemon, setAllPokemon] = useState({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(false);
  const frNameCache = useRef({});

  const currentGen = GENERATIONS.find((g) => g.value === gen);

  useEffect(() => {
    const ids = buildRange(currentGen);
    const missing = ids.filter((id) => !allPokemon[id]);
    if (!missing.length) return;
    setLoading(true);

    const fetchBatch = async () => {
      const results = await Promise.all(
        missing.map(async (id) => {
          try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            if (!res.ok) return null;
            const data = await res.json();
            return { id, name: data.name, frName: frNameCache.current[id] || null };
          } catch { return null; }
        })
      );
      const entries = {};
      results.forEach((p) => { if (p) entries[p.id] = p; });
      setAllPokemon((prev) => ({ ...prev, ...entries }));
      setLoading(false);

      results.forEach(async (p) => {
        if (!p || frNameCache.current[p.id]) return;
        const frName = await fetchFrenchName(p.id);
        if (frName) {
          frNameCache.current[p.id] = frName;
          setAllPokemon((prev) =>
            prev[p.id] ? { ...prev, [p.id]: { ...prev[p.id], frName } } : prev
          );
        }
      });
    };
    fetchBatch();
  }, [gen]);

  const visibleIds = buildRange(currentGen).filter((id) => {
    const p = allPokemon[id];
    if (!p) return true;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.frName || p.name).toLowerCase().includes(q) || String(p.id).includes(q);
  });

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleExport = async () => {
    setExporting(true);
    await exportImage(selected, allPokemon);
    setExporting(false);
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Toast confirmation */}
      {toast && (
        <div className="fixed top-6 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
          <div className="bg-green-500 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg animate-bounce">
            ✅ Image enregistrée !
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-3">

          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">
              Poké<span className="text-orange-500">List</span>
            </h1>
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                >
                  Tout effacer
                </button>
                <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-bold">
                  {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          <input
            type="text"
            placeholder="🔍  Rechercher un Pokémon…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-100 border-0 text-gray-800 text-sm px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-gray-400 mb-3"
          />

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {GENERATIONS.map((g) => (
              <button
                key={g.value}
                onClick={() => setGen(g.value)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors
                  ${gen === g.value
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Grille */}
      <main className="max-w-2xl mx-auto px-4 py-4">
        {loading && Object.keys(allPokemon).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
            <span className="text-4xl animate-bounce">⚡</span>
            <p className="text-sm">Chargement…</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {visibleIds.map((id) => {
              const p = allPokemon[id];
              if (!p) return (
                <div key={id} className="h-24 rounded-2xl bg-white animate-pulse" />
              );
              return (
                <PokeCard key={id} pokemon={p} selected={selected.has(id)} onToggle={toggleSelect} />
              );
            })}
          </div>
        )}

        {visibleIds.length === 0 && !loading && (
          <p className="text-center text-gray-400 py-16 text-sm">
            Aucun résultat pour « {search} »
          </p>
        )}
      </main>

      {/* Bouton export flottant */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 px-4">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 disabled:opacity-60 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-orange-200 transition-all text-sm"
          >
            {exporting ? "Export en cours…" : `⬇ Exporter ma liste (${selected.size})`}
          </button>
        </div>
      )}

      {selected.size > 0 && <div className="h-24" />}
    </div>
  );
}
