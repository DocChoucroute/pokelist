import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

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

const TYPE_COLORS = {
  fire: "#FF6B35", water: "#4FC3F7", grass: "#66BB6A", electric: "#FFD54F",
  psychic: "#F06292", ice: "#80DEEA", dragon: "#7986CB", dark: "#78909C",
  fairy: "#F48FB1", normal: "#BDBDBD", fighting: "#FF7043", flying: "#90CAF9",
  poison: "#CE93D8", ground: "#FFCC80", rock: "#D7CCC8", bug: "#AED581",
  ghost: "#B39DDB", steel: "#90A4AE",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function buildPokedexRange(gen) {
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
  } catch {
    return null;
  }
}

// ─── Export helper ────────────────────────────────────────────────────────────

async function exportSelectionAsImage(selected, allPokemon) {
  const list = [...selected]
    .map((id) => allPokemon.find((p) => p.id === id))
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);

  if (list.length === 0) return;

  const COLS = Math.min(8, list.length);
  const ROWS = Math.ceil(list.length / COLS);
  const CELL_W = 96;
  const CELL_H = 110;
  const PADDING = 16;
  const HEADER = 48;

  const canvas = document.createElement("canvas");
  canvas.width = COLS * CELL_W + PADDING * 2;
  canvas.height = ROWS * CELL_H + PADDING * 2 + HEADER;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header
  ctx.fillStyle = "#e63946";
  ctx.fillRect(0, 0, canvas.width, HEADER);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `PokéList · ${list.length} Pokémon sélectionné${list.length > 1 ? "s" : ""}`,
    canvas.width / 2,
    HEADER / 2 + 6
  );

  // Load all images
  const loadImg = (url) =>
    new Promise((res) => {
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
    const x = PADDING + col * CELL_W;
    const y = PADDING + HEADER + row * CELL_H;

    // Card background
    ctx.fillStyle = "#16213e";
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4, 8);
    ctx.fill();

    // Sprite
    const img = images[i];
    if (img) {
      ctx.drawImage(img, x + (CELL_W - 72) / 2, y + 4, 72, 72);
    }

    // Name
    ctx.fillStyle = "#e0e0e0";
    ctx.font = "bold 9px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    const name = pokemon.frName || pokemon.name;
    ctx.fillText(name.length > 12 ? name.slice(0, 11) + "…" : name, x + CELL_W / 2, y + 82);

    // ID
    ctx.fillStyle = "#666";
    ctx.font = "8px monospace";
    ctx.fillText(`#${String(pokemon.id).padStart(3, "0")}`, x + CELL_W / 2, y + 94);
  });

  const link = document.createElement("a");
  link.download = `pokeliste-${list.length}-pokemon.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ─── PokéCard ─────────────────────────────────────────────────────────────────

function PokeCard({ pokemon, selected, onToggle }) {
  return (
    <button
      onClick={() => onToggle(pokemon.id)}
      title={pokemon.frName || pokemon.name}
      className={`
        relative group flex flex-col items-center gap-1 p-2 rounded-xl
        transition-all duration-150 cursor-pointer border-2
        ${selected
          ? "border-red-500 bg-red-950/40 scale-[1.04] shadow-lg shadow-red-900/40"
          : "border-transparent bg-[#16213e] hover:border-slate-600 hover:bg-[#1d2a4a]"
        }
      `}
    >
      {/* Checkmark */}
      {selected && (
        <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
          ✓
        </span>
      )}

      <img
        src={spriteUrl(pokemon.id)}
        alt={pokemon.frName || pokemon.name}
        width={64}
        height={64}
        loading="lazy"
        className={`w-14 h-14 object-contain transition-opacity ${selected ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}
      />
      <span className="text-[10px] font-semibold text-slate-300 truncate w-full text-center leading-tight">
        {pokemon.frName || pokemon.name}
      </span>
      <span className="text-[8px] text-slate-600 font-mono">
        #{String(pokemon.id).padStart(3, "0")}
      </span>
    </button>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [gen, setGen] = useState(1);
  const [search, setSearch] = useState("");
  const [allPokemon, setAllPokemon] = useState({}); // { [id]: { id, name, frName, types } }
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const frNameCache = useRef({});

  const currentGen = GENERATIONS.find((g) => g.value === gen);

  // Load Pokémon for current gen
  useEffect(() => {
    const ids = buildPokedexRange(currentGen);
    const missing = ids.filter((id) => !allPokemon[id]);
    if (missing.length === 0) return;

    setLoading(true);

    const fetchBatch = async () => {
      const results = await Promise.all(
        missing.map(async (id) => {
          try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            if (!res.ok) return null;
            const data = await res.json();
            return {
              id,
              name: data.name,
              frName: frNameCache.current[id] || null,
              types: data.types.map((t) => t.type.name),
            };
          } catch {
            return null;
          }
        })
      );

      const newEntries = {};
      results.forEach((p) => { if (p) newEntries[p.id] = p; });
      setAllPokemon((prev) => ({ ...prev, ...newEntries }));
      setLoading(false);

      // Fetch French names in background
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

  const visibleIds = buildPokedexRange(currentGen).filter((id) => {
    const p = allPokemon[id];
    if (!p) return true; // show skeleton
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.frName || p.name).toLowerCase().includes(q) ||
      String(p.id).includes(q)
    );
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
    await exportSelectionAsImage(selected, Object.values(allPokemon));
    setExporting(false);
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0f0f1a]/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Title */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight">
              Poké<span className="text-red-500">List</span>
            </span>
            {selected.size > 0 && (
              <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold">
                {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
            {/* Search */}
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#16213e] border border-slate-700 text-white text-sm px-3 py-1.5 rounded-lg outline-none focus:border-red-500 w-40 placeholder:text-slate-500"
            />

            {/* Gen filter */}
            <div className="flex flex-wrap gap-1">
              {GENERATIONS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGen(g.value)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors
                    ${gen === g.value
                      ? "bg-red-600 text-white"
                      : "bg-[#16213e] text-slate-400 hover:bg-[#1d2a4a] hover:text-white"
                    }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Export button */}
            {selected.size > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="ml-auto sm:ml-0 flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition-colors"
              >
                {exporting ? (
                  <>
                    <span className="animate-spin text-base">⏳</span> Export…
                  </>
                ) : (
                  <>⬇ Exporter ({selected.size})</>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading && Object.keys(allPokemon).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
            <span className="text-4xl animate-bounce">⚡</span>
            <p className="text-sm">Chargement…</p>
          </div>
        ) : (
          <>
            {selected.size > 0 && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-400">
                  {selected.size} Pokémon sélectionné{selected.size > 1 ? "s" : ""}
                  {" · "}
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-red-400 hover:text-red-300 underline underline-offset-2"
                  >
                    Tout désélectionner
                  </button>
                </p>
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
              {visibleIds.map((id) => {
                const p = allPokemon[id];
                if (!p) {
                  // Skeleton
                  return (
                    <div
                      key={id}
                      className="h-24 rounded-xl bg-[#16213e] animate-pulse"
                    />
                  );
                }
                return (
                  <PokeCard
                    key={id}
                    pokemon={p}
                    selected={selected.has(id)}
                    onToggle={toggleSelect}
                  />
                );
              })}
            </div>
            {visibleIds.length === 0 && (
              <p className="text-center text-slate-500 py-16 text-sm">
                Aucun Pokémon trouvé pour « {search} »
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
