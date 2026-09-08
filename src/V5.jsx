import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

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

const STORAGE_LISTS_KEY = "pokelist-lists-v2";
const STORAGE_ACTIVE_KEY = "pokelist-active-list";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function loadLists() {
  try {
    const raw = localStorage.getItem(STORAGE_LISTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLists(lists) {
  try { localStorage.setItem(STORAGE_LISTS_KEY, JSON.stringify(lists)); } catch {}
}

function newList(name) {
  return { id: Date.now().toString(), name, pokemonIds: [], createdAt: Date.now() };
}

// ─── Export image ─────────────────────────────────────────────────────────────

async function exportImage(pokemonIds, allPokemon, listName) {
  const list = pokemonIds.map((id) => allPokemon[id]).filter(Boolean).sort((a, b) => a.id - b.id);
  if (!list.length) return;

  const W = 720, HEADER_H = 100, FOOTER_H = 60, PADDING = 24;
  const COLS = 4, CELL = Math.floor((W - PADDING * 2) / COLS);
  const SPRITE = 120, CELL_H = SPRITE + 44;
  const ROWS = Math.ceil(list.length / COLS);
  const H = Math.max(1280, HEADER_H + ROWS * CELL_H + PADDING * 3 + FOOTER_H);

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#F8F7F4"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FF6B00"; ctx.fillRect(0, 0, W, HEADER_H);
  ctx.fillStyle = "#fff"; ctx.font = "bold 36px 'Segoe UI', Arial, sans-serif"; ctx.textAlign = "left";
  ctx.fillText("Poké", 32, 58);
  ctx.fillStyle = "#FFD599"; ctx.fillText("List", 32 + ctx.measureText("Poké").width, 58);
  ctx.fillStyle = "#fff"; ctx.font = "16px 'Segoe UI', Arial, sans-serif"; ctx.textAlign = "right";
  ctx.fillText(listName, W - 32, 42);
  ctx.font = "13px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(`${list.length} cartes recherchées`, W - 32, 62);

  const loadImg = (url) => new Promise((res) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => res(img); img.onerror = () => res(null); img.src = url;
  });
  const images = await Promise.all(list.map((p) => loadImg(spriteUrl(p.id))));

  list.forEach((pokemon, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = PADDING + col * CELL, y = HEADER_H + PADDING + row * CELL_H;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(x + 4, y + 4, CELL - 8, CELL_H - 6, 12); ctx.fill();
    if (images[i]) ctx.drawImage(images[i], x + (CELL - SPRITE) / 2, y + 8, SPRITE, SPRITE);
    ctx.fillStyle = "#1a1a1a"; ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif"; ctx.textAlign = "center";
    const name = pokemon.frName || pokemon.name;
    ctx.fillText(name.length > 10 ? name.slice(0, 9) + "…" : name, x + CELL / 2, y + SPRITE + 22);
    ctx.fillStyle = "#999"; ctx.font = "11px monospace";
    ctx.fillText(`#${String(pokemon.id).padStart(3, "0")}`, x + CELL / 2, y + SPRITE + 38);
  });

  ctx.fillStyle = "#eee"; ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
  ctx.fillStyle = "#999"; ctx.font = "14px 'Segoe UI', Arial, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("Créé avec PokéList", W / 2, H - FOOTER_H + 36);

  const link = document.createElement("a");
  link.download = `pokeliste-${listName.replace(/\s/g, "-")}.png`;
  link.href = canvas.toDataURL("image/png"); link.click();
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────

function QRModal({ list, onClose }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const data = JSON.stringify({ name: list.name, pokemonIds: list.pokemonIds, v: 1 });
    // Charger qrcode via CDN
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.onload = () => {
      if (canvasRef.current) {
        canvasRef.current.innerHTML = "";
        new window.QRCode(canvasRef.current, {
          text: data,
          width: 260,
          height: 260,
          colorDark: "#1a1a1a",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.M,
        });
        setReady(true);
      }
    };
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch {} };
  }, [list]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-black text-gray-900 mb-1">Partager la liste</h2>
        <p className="text-sm text-gray-500 mb-4">L'autre personne scanne ce QR code depuis l'app pour importer <span className="font-semibold text-gray-700">"{list.name}"</span></p>
        <div className="flex justify-center mb-4">
          <div ref={canvasRef} className="rounded-xl overflow-hidden" />
          {!ready && <div className="w-[260px] h-[260px] bg-gray-100 rounded-xl animate-pulse" />}
        </div>
        <p className="text-xs text-gray-400 text-center mb-4">{list.pokemonIds.length} Pokémon · Données encodées dans le QR</p>
        <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-2xl text-sm transition-colors">
          Fermer
        </button>
      </div>
    </div>
  );
}

// ─── Scanner Modal ─────────────────────────────────────────────────────────────

function ScannerModal({ onImport, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(true);
  const streamRef = useRef(null);

  useEffect(() => {
    let interval;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // Charger jsQR
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js";
        script.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          interval = setInterval(() => {
            const video = videoRef.current;
            if (!video || !window.jsQR) return;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              try {
                const data = JSON.parse(code.data);
                if (data.pokemonIds && data.name) {
                  clearInterval(interval);
                  stopCamera();
                  onImport(data);
                }
              } catch {}
            }
          }, 300);
        };
        document.body.appendChild(script);
      } catch (e) {
        setError("Impossible d'accéder à la caméra. Autorise l'accès depuis les paramètres du navigateur.");
      }
    };

    const stopCamera = () => {
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); }
    };

    startCamera();
    return () => { clearInterval(interval); if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-black text-gray-900 mb-1">Scanner un QR code</h2>
        <p className="text-sm text-gray-500 mb-4">Pointe la caméra vers le QR code de la liste à importer</p>
        {error ? (
          <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4 mb-4">{error}</div>
        ) : (
          <div className="rounded-2xl overflow-hidden bg-black mb-4 relative">
            <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-square object-cover" />
            {/* Viseur */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-orange-400 rounded-xl opacity-80" />
            </div>
          </div>
        )}
        <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-2xl text-sm transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── PokeCard ─────────────────────────────────────────────────────────────────

function PokeCard({ pokemon, selected, onToggle }) {
  return (
    <button onClick={() => onToggle(pokemon.id)}
      className={`relative flex flex-col items-center gap-0.5 p-1.5 rounded-2xl transition-all duration-150 cursor-pointer border-2 w-full
        ${selected ? "border-orange-400 bg-orange-50 shadow-md shadow-orange-100" : "border-transparent bg-white hover:border-gray-200 hover:shadow-sm"}`}>
      {selected && <span className="absolute top-1.5 right-1.5 bg-orange-400 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">✓</span>}
      <img src={spriteUrl(pokemon.id)} alt={pokemon.frName || pokemon.name} width={56} height={56} loading="lazy" className="w-12 h-12 object-contain" />
      <span className={`text-[10px] font-semibold truncate w-full text-center leading-tight ${selected ? "text-orange-700" : "text-gray-700"}`}>{pokemon.frName || pokemon.name}</span>
      <span className="text-[8px] text-gray-400 font-mono">#{String(pokemon.id).padStart(3, "0")}</span>
    </button>
  );
}

// ─── WishlistCard ─────────────────────────────────────────────────────────────

function WishlistCard({ pokemon, onRemove }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl px-3 py-2 border border-gray-100 shadow-sm">
      <img src={spriteUrl(pokemon.id)} alt={pokemon.frName || pokemon.name} width={48} height={48} loading="lazy" className="w-11 h-11 object-contain flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{pokemon.frName || pokemon.name}</p>
        <p className="text-[10px] text-gray-400 font-mono">#{String(pokemon.id).padStart(3, "0")}</p>
      </div>
      <button onClick={() => onRemove(pokemon.id)} className="flex-shrink-0 w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center text-sm transition-colors">✕</button>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState("pokedex");
  const [gen, setGen] = useState(1);
  const [search, setSearch] = useState("");
  const [wishSearch, setWishSearch] = useState("");
  const [allPokemon, setAllPokemon] = useState({});
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState(() => {
    const loaded = loadLists();
    return loaded.length > 0 ? loaded : [newList("Ma collection")];
  });
  const [activeListId, setActiveListId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_ACTIVE_KEY);
    return saved || null;
  });
  const [viewingListId, setViewingListId] = useState(null); // null = vue grille des listes
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [showQR, setShowQR] = useState(null); // list object
  const [showScanner, setShowScanner] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const frNameCache = useRef({});

  const activeList = lists.find((l) => l.id === activeListId) || lists[0];
  const viewingList = lists.find((l) => l.id === viewingListId);

  // Sync localStorage
  useEffect(() => { saveLists(lists); }, [lists]);
  useEffect(() => { if (activeList) localStorage.setItem(STORAGE_ACTIVE_KEY, activeList.id); }, [activeList]);

  const currentGen = GENERATIONS.find((g) => g.value === gen);

  // Charger Pokémon du Pokédex
  useEffect(() => {
    const ids = buildRange(currentGen);
    const missing = ids.filter((id) => !allPokemon[id]);
    if (!missing.length) return;
    setLoading(true);
    const fetchBatch = async () => {
      const results = await Promise.all(missing.map(async (id) => {
        try {
          const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
          if (!res.ok) return null;
          const data = await res.json();
          return { id, name: data.name, frName: frNameCache.current[id] || null };
        } catch { return null; }
      }));
      const entries = {};
      results.forEach((p) => { if (p) entries[p.id] = p; });
      setAllPokemon((prev) => ({ ...prev, ...entries }));
      setLoading(false);
      results.forEach(async (p) => {
        if (!p || frNameCache.current[p.id]) return;
        const frName = await fetchFrenchName(p.id);
        if (frName) {
          frNameCache.current[p.id] = frName;
          setAllPokemon((prev) => prev[p.id] ? { ...prev, [p.id]: { ...prev[p.id], frName } } : prev);
        }
      });
    };
    fetchBatch();
  }, [gen]);

  // Charger Pokémon des listes sauvegardées
  useEffect(() => {
    const allIds = [...new Set(lists.flatMap((l) => l.pokemonIds))];
    const missing = allIds.filter((id) => !allPokemon[id]);
    missing.forEach(async (id) => {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        const frName = frNameCache.current[id] || await fetchFrenchName(id);
        if (frName) frNameCache.current[id] = frName;
        setAllPokemon((prev) => ({ ...prev, [id]: { id, name: data.name, frName: frNameCache.current[id] || null } }));
      } catch {}
    });
  }, []);

  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const togglePokemonInList = useCallback((pokemonId) => {
    setLists((prev) => prev.map((l) => {
      if (l.id !== activeList.id) return l;
      const ids = l.pokemonIds.includes(pokemonId)
        ? l.pokemonIds.filter((id) => id !== pokemonId)
        : [...l.pokemonIds, pokemonId];
      return { ...l, pokemonIds: ids };
    }));
  }, [activeList]);

  const removeFromList = useCallback((listId, pokemonId) => {
    setLists((prev) => prev.map((l) =>
      l.id === listId ? { ...l, pokemonIds: l.pokemonIds.filter((id) => id !== pokemonId) } : l
    ));
  }, []);

  const createList = () => {
    if (!newListName.trim()) return;
    const list = newList(newListName.trim());
    setLists((prev) => [...prev, list]);
    setActiveListId(list.id);
    setNewListName("");
    setShowNewList(false);
    showToast(`Liste "${list.name}" créée !`, "add");
  };

  const deleteList = (listId) => {
    if (lists.length === 1) { showToast("Tu ne peux pas supprimer la dernière liste", "remove"); return; }
    if (!confirm("Supprimer cette liste ?")) return;
    setLists((prev) => prev.filter((l) => l.id !== listId));
    if (activeListId === listId) setActiveListId(lists.find((l) => l.id !== listId)?.id);
    if (viewingListId === listId) setViewingListId(null);
    showToast("Liste supprimée", "remove");
  };

  const handleImportQR = useCallback((data) => {
    setShowScanner(false);
    const imported = { id: Date.now().toString(), name: data.name + " (importée)", pokemonIds: data.pokemonIds, createdAt: Date.now() };
    setLists((prev) => [...prev, imported]);
    showToast(`Liste "${data.name}" importée !`, "add");
    // Charger les Pokémon importés
    data.pokemonIds.forEach(async (id) => {
      if (allPokemon[id]) return;
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        if (!res.ok) return;
        const d = await res.json();
        const frName = await fetchFrenchName(id);
        if (frName) frNameCache.current[id] = frName;
        setAllPokemon((prev) => ({ ...prev, [id]: { id, name: d.name, frName: frNameCache.current[id] || null } }));
      } catch {}
    });
  }, [allPokemon]);

  const handleExport = async (list) => {
    setExporting(true);
    await exportImage(list.pokemonIds, allPokemon, list.name);
    setExporting(false);
    showToast("Image enregistrée !", "success");
  };

  const visibleIds = buildRange(currentGen).filter((id) => {
    const p = allPokemon[id];
    if (!p) return true;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.frName || p.name).toLowerCase().includes(q) || String(id).includes(q);
  });

  const activeSelected = new Set(activeList?.pokemonIds || []);

  // Pokémon de la liste en cours de visualisation
  const viewingPokemon = (viewingList?.pokemonIds || [])
    .map((id) => allPokemon[id]).filter(Boolean)
    .filter((p) => {
      if (!wishSearch.trim()) return true;
      const q = wishSearch.toLowerCase();
      return (p.frName || p.name).toLowerCase().includes(q) || String(p.id).includes(q);
    })
    .sort((a, b) => a.id - b.id);

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-28">

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
          <div className={`text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg
            ${toast.type === "success" ? "bg-green-500" : toast.type === "add" ? "bg-orange-500" : "bg-gray-500"}`}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* Modals */}
      {showQR && <QRModal list={showQR} onClose={() => setShowQR(null)} />}
      {showScanner && <ScannerModal onImport={handleImportQR} onClose={() => setShowScanner(false)} />}

      {/* Modal nouvelle liste */}
      {showNewList && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={() => setShowNewList(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-gray-900 mb-4">Nouvelle liste</h2>
            <input
              autoFocus
              type="text"
              placeholder="Ex : Cartes manquantes Amis…"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createList()}
              className="w-full bg-gray-100 text-gray-800 text-sm px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-300 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNewList(false)} className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm">Annuler</button>
              <button onClick={createList} disabled={!newListName.trim()} className="flex-1 bg-orange-500 disabled:opacity-40 text-white font-semibold py-3 rounded-2xl text-sm">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">Poké<span className="text-orange-500">List</span></h1>
            <div className="flex items-center gap-2">
              {tab === "pokedex" && activeList && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-bold truncate max-w-[140px]">
                  → {activeList.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex border-b border-gray-100">
            <button onClick={() => setTab("pokedex")}
              className={`flex-1 text-sm font-semibold py-2.5 border-b-2 transition-colors
                ${tab === "pokedex" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400"}`}>
              Pokédex
            </button>
            <button onClick={() => { setTab("lists"); setViewingListId(null); }}
              className={`flex-1 text-sm font-semibold py-2.5 border-b-2 transition-colors flex items-center justify-center gap-1.5
                ${tab === "lists" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400"}`}>
              Mes listes
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === "lists" ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                {lists.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── POKÉDEX ── */}
      {tab === "pokedex" && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          {/* Sélecteur de liste active */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
            {lists.map((l) => (
              <button key={l.id} onClick={() => setActiveListId(l.id)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors border
                  ${activeList?.id === l.id ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-500 border-gray-200 hover:border-orange-300"}`}>
                {l.name} {l.pokemonIds.length > 0 && <span className="ml-1 opacity-70">({l.pokemonIds.length})</span>}
              </button>
            ))}
          </div>

          <input type="text" placeholder="🔍  Rechercher un Pokémon…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-100 border-0 text-gray-800 text-sm px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-gray-400 mb-3" />

          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
            {GENERATIONS.map((g) => (
              <button key={g.value} onClick={() => setGen(g.value)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors
                  ${gen === g.value ? "bg-orange-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                {g.label}
              </button>
            ))}
          </div>

          {loading && Object.keys(allPokemon).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
              <span className="text-4xl animate-bounce">⚡</span>
              <p className="text-sm">Chargement…</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {visibleIds.map((id) => {
                const p = allPokemon[id];
                if (!p) return <div key={id} className="h-24 rounded-2xl bg-white animate-pulse" />;
                return <PokeCard key={id} pokemon={p} selected={activeSelected.has(id)} onToggle={togglePokemonInList} />;
              })}
            </div>
          )}
          {visibleIds.length === 0 && !loading && (
            <p className="text-center text-gray-400 py-16 text-sm">Aucun résultat pour « {search} »</p>
          )}
        </div>
      )}

      {/* ── MES LISTES ── */}
      {tab === "lists" && !viewingListId && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          {/* Actions */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => setShowNewList(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold py-3 rounded-2xl transition-colors">
              + Nouvelle liste
            </button>
            <button onClick={() => setShowScanner(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-orange-300 text-gray-700 text-sm font-semibold py-3 rounded-2xl transition-colors">
              📷 Importer
            </button>
          </div>

          {/* Grille des listes */}
          <div className="flex flex-col gap-3">
            {lists.map((l) => (
              <div key={l.id} className={`bg-white rounded-2xl border-2 transition-colors overflow-hidden
                ${activeList?.id === l.id ? "border-orange-300" : "border-gray-100"}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Aperçu sprites */}
                  <div className="flex -space-x-2 flex-shrink-0">
                    {l.pokemonIds.slice(0, 3).map((id) => (
                      <img key={id} src={spriteUrl(id)} alt="" width={32} height={32} className="w-8 h-8 object-contain rounded-full bg-gray-50 border border-white" />
                    ))}
                    {l.pokemonIds.length === 0 && <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 text-lg">?</div>}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0" onClick={() => { setViewingListId(l.id); setWishSearch(""); }}>
                    <p className="text-sm font-bold text-gray-800 truncate">{l.name}</p>
                    <p className="text-xs text-gray-400">{l.pokemonIds.length} Pokémon</p>
                  </div>

                  {/* Badge liste active */}
                  {activeList?.id === l.id && (
                    <span className="text-[10px] bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full flex-shrink-0">active</span>
                  )}
                </div>

                {/* Actions de la liste */}
                <div className="flex border-t border-gray-50">
                  <button onClick={() => setActiveListId(l.id)}
                    className={`flex-1 text-xs py-2.5 font-semibold transition-colors
                      ${activeList?.id === l.id ? "text-orange-500" : "text-gray-400 hover:text-orange-500"}`}>
                    {activeList?.id === l.id ? "✓ Active" : "Activer"}
                  </button>
                  <button onClick={() => { setViewingListId(l.id); setWishSearch(""); }}
                    className="flex-1 text-xs py-2.5 font-semibold text-gray-400 hover:text-gray-700 transition-colors border-x border-gray-50">
                    Voir
                  </button>
                  <button onClick={() => setShowQR(l)} disabled={l.pokemonIds.length === 0}
                    className="flex-1 text-xs py-2.5 font-semibold text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors border-x border-gray-50">
                    QR
                  </button>
                  <button onClick={() => handleExport(l)} disabled={l.pokemonIds.length === 0 || exporting}
                    className="flex-1 text-xs py-2.5 font-semibold text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors border-x border-gray-50">
                    ⬇
                  </button>
                  <button onClick={() => deleteList(l.id)}
                    className="flex-1 text-xs py-2.5 font-semibold text-red-300 hover:text-red-500 transition-colors">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DÉTAIL D'UNE LISTE ── */}
      {tab === "lists" && viewingListId && viewingList && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setViewingListId(null)} className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-orange-300 transition-colors">←</button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-black text-gray-900 truncate">{viewingList.name}</h2>
              <p className="text-xs text-gray-400">{viewingList.pokemonIds.length} Pokémon</p>
            </div>
            <button onClick={() => setShowQR(viewingList)} disabled={viewingList.pokemonIds.length === 0}
              className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-600 font-semibold px-3 py-2 rounded-xl transition-colors">
              QR
            </button>
            <button onClick={() => handleExport(viewingList)} disabled={viewingList.pokemonIds.length === 0 || exporting}
              className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold px-3 py-2 rounded-xl transition-colors">
              ⬇ Export
            </button>
          </div>

          {viewingList.pokemonIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <span className="text-5xl">🎴</span>
              <p className="text-sm font-medium">Liste vide</p>
              <button onClick={() => { setActiveListId(viewingList.id); setTab("pokedex"); }}
                className="mt-2 text-xs bg-orange-500 text-white px-4 py-2 rounded-full font-semibold">
                Ajouter des Pokémon →
              </button>
            </div>
          ) : (
            <>
              <input type="text" placeholder="🔍  Filtrer…" value={wishSearch} onChange={(e) => setWishSearch(e.target.value)}
                className="w-full bg-gray-100 border-0 text-gray-800 text-sm px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-gray-400 mb-3" />
              <div className="flex flex-col gap-2">
                {viewingPokemon.map((p) => (
                  <WishlistCard key={p.id} pokemon={p} onRemove={(id) => removeFromList(viewingList.id, id)} />
                ))}
              </div>
              {viewingPokemon.length === 0 && wishSearch && (
                <p className="text-center text-gray-400 py-8 text-sm">Aucun résultat pour « {wishSearch} »</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
