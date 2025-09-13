"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Download, Eye, EyeOff, PartyPopper, Play, Plus, Settings, Share2, Upload, Wand2 } from "lucide-react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Compat Next.js / Vite / fallback window
const SB_URL = "https://myxfrmhiwzdeifihoiep.supabase.co";
//  (typeof process !== "undefined" ? (process as any).env?.NEXT_PUBLIC_SUPABASE_URL : undefined) ??
//  (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined) ??
//  (typeof window !== "undefined" ? (window as any).SUPABASE_URL : undefined);

const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15eGZybWhpd3pkZWlmaWhvaWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MjEyOTcsImV4cCI6MjA3MzE5NzI5N30.g4L4VJ-1DGTC-vphy6E9hjzJ6thoNVikOuLHaJT5nIE";
//  (typeof process !== "undefined" ? (process as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined) ??
//  (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY : undefined) ??
//  (typeof window !== "undefined" ? (window as any).SUPABASE_ANON_KEY : undefined);

const DEFAULT_STATE = {
  settings: {
    eventTitle: "40 ans Manu", 
    eventDate: "",
    requireApproval: true,
    adminPin: "2025",
    rotateSeconds: 10,
    showAuthorsByDefault: false,
  },
  anecdotes: [] as Anecdote[],
};

const supabase: SupabaseClient | null =
  SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;
const EVENT_ID = "default"; // ou un id par soirée

function getDeviceId() {
  try {
    const k = "device_id";
    let v = localStorage.getItem(k);
    if (!v) { v = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2); localStorage.setItem(k, v); }
    return v;
  } catch { return "unknown"; }
}


// ---------------- Toast (polyfill) ----------------
function useToast() {
  const toast = ({ title, description }: { title: string; description?: string }) => {
    alert(`${title}\n${description ?? ""}`);
  };
  return { toast };
}

// ---------------- Types ----------------
interface Anecdote { 
  id: string;
  text: string;
  author: string;
  // legacy fields kept for migration compatibility
  anonymous?: boolean;
  category?: string;
  approved: boolean;
  created_at: Date; // ISO
  reactions?: Record<string, number>; // emoji -> count
}

interface SettingsType {
  eventTitle: string;
  eventDate: string; // display only
  requireApproval: boolean;
  adminPin: string; // simple protection
  rotateSeconds: number;
  showAuthorsByDefault: boolean; // only admin can toggle
}

// ---------------- Storage ----------------
const STORAGE_KEY = "anecparty:v1";

function loadState(): { settings: SettingsType; anecdotes: Anecdote[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw);
    parsed.settings = {
      eventTitle: parsed.settings?.eventTitle ?? DEFAULT_STATE.settings.eventTitle,
      eventDate: parsed.settings?.eventDate ?? DEFAULT_STATE.settings.eventDate,
      requireApproval: Boolean(parsed.settings?.requireApproval ?? DEFAULT_STATE.settings.requireApproval),
      adminPin: parsed.settings?.adminPin ?? DEFAULT_STATE.settings.adminPin,
      rotateSeconds: Number(parsed.settings?.rotateSeconds ?? DEFAULT_STATE.settings.rotateSeconds),
      showAuthorsByDefault: Boolean(parsed.settings?.showAuthorsByDefault ?? DEFAULT_STATE.settings.showAuthorsByDefault),
    } as SettingsType;
    parsed.anecdotes = (Array.isArray(parsed.anecdotes) ? parsed.anecdotes : []).map((a: Anecdote) => ({
      ...a,
      anonymous: false, // force non-anonymous
      category: a.category ?? "general",
      reactions: a.reactions ?? {},
    }));
    return parsed;
  } catch {
    return {
      settings: {
        eventTitle: DEFAULT_STATE.settings.eventDate,
        eventDate: DEFAULT_STATE.settings.eventDate,
        requireApproval: DEFAULT_STATE.settings.requireApproval,
        adminPin: DEFAULT_STATE.settings.adminPin,
        rotateSeconds: DEFAULT_STATE.settings.rotateSeconds,
        showAuthorsByDefault: DEFAULT_STATE.settings.showAuthorsByDefault,
      },
      anecdotes: [],
    };
  }
}

function saveState(s: { settings: SettingsType; anecdotes: Anecdote[] }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ---------------- Utils ----------------
const INVITES = [
  "Didier","Brigitte","Raymond","Maryvonne","Manuel","Séverine","David","Caroline","Mathieu G","Lucie","Sylvain","Céline","Max","Jennifer","Damien B","Matthieu H","Stéphane","Alex","Romain","Anne So","Seb","Anne-Charlotte","Julie","Damien","Florian","Marie","Morgane","Paul","Vincent"
].sort((a,b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

const EMOJIS = ["👍","😂","😯","❤️"]; // réactions disponibles
const NAMES = ["like","rire","surpris","coeur"];
const EMOJI_NAMES = Object.fromEntries(
  EMOJIS.map((emoji, i) => [emoji, NAMES[i]])
);

function exportJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(anecdotes: Anecdote[], filename: string) {
  const header = ["id", "text", "author", "approved", "created_at", ...EMOJIS];
  const rows = anecdotes.map(a => [
    a.id,
    JSON.stringify(a.text).slice(1,-1),
    JSON.stringify(a.author).slice(1,-1),
    a.approved,
    a.created_at,
    ...EMOJIS.map(e => a.reactions?.[e] ?? 0),
  ]);
  const content = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function classNames(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

function hasReacted(id: string, emoji: string) { try {return localStorage.getItem(`react:${id}:${EMOJI_NAMES[emoji]}`) === "1";} catch { return false; }}
function markReacted(id: string, emoji: string) { try {localStorage.setItem(`react:${id}:${EMOJI_NAMES[emoji]}`,"1"); } catch {}}
function unmarkReacted(id: string, emoji: string) { try {localStorage.removeItem(`react:${id}:${EMOJI_NAMES[emoji]}`); } catch {}} 

function totalReactions(a: Anecdote) {
  return Object.values(a.reactions ?? {}).reduce((s, n) => s + (Number(n) || 0), 0);
}

// ---------------- Server helpers (Supabase) ----------------
async function fetchAnecdotesFromServer(requireApproval: boolean, isAdmin: boolean): Promise<Anecdote[]> {
  if (!supabase) return [];
  const base = supabase.from("anecdotes")
    .select("id,text,author,approved,created_at")
    .eq("event_id", EVENT_ID);

  const { data: rows, error } =
    requireApproval && !isAdmin ? await base.eq("approved", true)
                                : await base;
  if (error) { console.error(error); return []; }

  // Récupère toutes les réactions des anecdotes visibles et agrège côté client
  const ids = rows?.map((r : Anecdote) => r.id) ?? [];
  const { data: reacts, error: rerr } = ids.length
    ? await supabase.from("reactions").select("anecdote_id,emoji").in("anecdote_id", ids)
    : { data: [], error: null };

  const map: Record<string, Record<string, number>> = {};
  if (!rerr && reacts) {
    for (const r of reacts) {
      map[r.anecdote_id] = map[r.anecdote_id] || {};
      map[r.anecdote_id][r.emoji] = (map[r.anecdote_id][r.emoji] ?? 0) + 1;
    }
  }

  return (rows ?? []).map((r : Anecdote) => ({
    id: r.id,
    text: r.text,
    author: r.author,
    approved: r.approved,
    created_at: r.created_at,
    reactions: map[r.id] ?? {},
    anonymous: false,
    category: "general",
  }));
}

async function submitAnecdoteServer(payload: { text: string; author: string }, requireApproval: boolean) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("anecdotes").insert({
    text: payload.text,
    author: payload.author,
    approved: !requireApproval,
    device_id: getDeviceId(),
    event_id: EVENT_ID
  }).select("id,text,author,approved,created_at").single();
  if (error) throw error;
  return {
    id: data.id, text: data.text, author: data.author,
    approved: data.approved, created_at: data.created_at,
    reactions: {}, anonymous: false, category: "general"
  } as Anecdote;
}

async function toggleReactionServer(id: string, emoji: string) {
  if (!supabase) return;
  const device_id = getDeviceId();
  if (hasReacted(id, emoji)) {
    await supabase.from("reactions").delete().match({ anecdote_id: id, emoji, device_id });
  } else {
    await supabase.from("reactions").insert({ anecdote_id: id, emoji, device_id });
  }
}

async function editAnecdoteServer(id: string, newText: string, requireApproval: boolean) {
  if (!supabase) return;
  await supabase.from("anecdotes").update({
    text: newText,
    approved: !requireApproval
  }).eq("id", id);
}

async function approveServer(id: string, val: boolean) {
  if (!supabase) return;
  await supabase.from("anecdotes").update({ approved: val }).eq("id", id);
}

async function removeServer(id: string) {
  if (!supabase) return;
  await supabase.from("anecdotes").delete().eq("id", id);
}

// ---------------- App ----------------
export default function App() {
  const { toast } = useToast();
  //const [state, setState] = useState(loadState());
  const [state, setState] = useState(DEFAULT_STATE);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [partyMode, setPartyMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAuthors, setShowAuthors] = useState<boolean>(state.settings.showAuthorsByDefault);
  const [minReactions, setMinReactions] = useState<number>(0);
  const [meAuthor] = useState<string>(() => {
    try { return localStorage.getItem('lastAuthor') || ""; } catch { return ""; }
  });
  const [onlyMine, setOnlyMine] = useState<boolean>(false);
 const [noMyReactions, setNoMyReactions] = useState<boolean>(false);

  useEffect(() => {
  const onStorage = (e: StorageEvent) => {
    if (!e.key?.startsWith("react:")) return;
    // force un léger re-render; par ex. en “touchant” un state no-op
    setState(s => ({ ...s }));
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}, []);

  const mounted = useMounted();

  const filteredAnecdotes = useMemo(() => {
    const mine = meAuthor ? meAuthor.toLowerCase() : "";
    const pool = state.anecdotes.filter(a =>
      a.approved ||
      !state.settings.requireApproval ||
      isAdmin ||
      (mine && a.author.toLowerCase() === mine)  // <= inclure mes non validées
    );
  
    return pool
      .filter(a => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return a.text.toLowerCase().includes(q) || a.author.toLowerCase().includes(q);
      })
      .filter(a => !onlyMine || (meAuthor && a.author.toLowerCase() === meAuthor.toLowerCase()))
      .filter(a => totalReactions(a) >= minReactions)
      .filter(a => !noMyReactions || !mounted || EMOJIS.every(e => !hasReacted(a.id, e)))
      .sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  }, [state, search, isAdmin, minReactions, meAuthor, onlyMine, noMyReactions, mounted]);

  const partyItems = useMemo(() => {
    const pool = state.anecdotes.filter(a =>
      a.approved || !state.settings.requireApproval || isAdmin
    );
    return pool
      .filter(a => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return a.text.toLowerCase().includes(q) || a.author.toLowerCase().includes(q);
      })
      .filter(a => totalReactions(a) >= minReactions)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [state, isAdmin, search, minReactions]);
  
  const leaderboard = useMemo(() => {
    const mine = meAuthor ? meAuthor.toLowerCase() : "";
    const pool = state.anecdotes.filter(a =>
      a.approved ||
      !state.settings.requireApproval ||
      isAdmin
    );
    return [...pool].sort(
      (a, b) =>
        totalReactions(b) - totalReactions(a) ||
        (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    );
  }, [state, isAdmin, meAuthor]);

  // persist
  useEffect(() => saveState(state), [state]);

  // Fix SSR hydration: compléter la date d'affichage côté client uniquement
  useEffect(() => {
    if (!state.settings.eventDate) {
      setState(s => ({ ...s, settings: { ...s.settings, eventDate: new Date().toLocaleDateString() } }));
    }
  }, []); 

  // Initial fetch + realtime (Supabase)
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    (async () => {
      console.log("ok0");
      const items = await fetchAnecdotesFromServer(state.settings.requireApproval, isAdmin);
      if (mounted) setState(s => ({ ...s, anecdotes: items }));
    })();

    const channel = supabase
      .channel("anecparty")
      .on("postgres_changes", { event: "*", schema: "public", table: "anecdotes" }, () => {
        fetchAnecdotesFromServer(state.settings.requireApproval, isAdmin).then(items =>
          
          {
            console.log("ok"); 
            setState(s => ({ ...s, anecdotes: items }))
          }
        );
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, () => {
        fetchAnecdotesFromServer(state.settings.requireApproval, isAdmin).then(items =>
          {
            console.log("ok2");
            setState(s => ({ ...s, anecdotes: items }));
          }
        );
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [isAdmin, state.settings.requireApproval]);


  // party mode rotation
  useEffect(() => {
    if (!partyMode || filteredAnecdotes.length === 0) return;
    const id = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % Math.max(filteredAnecdotes.length, 1));
    }, Math.max(3, state.settings.rotateSeconds) * 1000);
    return () => clearInterval(id);
  }, [partyMode, state.settings.rotateSeconds, filteredAnecdotes.length]);

  // force authors visibility state to follow settings; only admin can toggle via settings panel switch
  useEffect(() => { setShowAuthors(state.settings.showAuthorsByDefault); }, [state.settings.showAuthorsByDefault]);

  useEffect(() => {
    try {
      const s = loadState();        // lit localStorage ici, pas pendant SSR
      setState(s);
    } catch { /* noop */ }
  }, []);

  // ---------------- Handlers ----------------
  const submitAnecdote = (payload: { text: string; author: string }) => {
    const localItem: Anecdote = {
      id: uuidv4(),
      text: payload.text,
      author: payload.author,
      anonymous: false,
      category: "general",
      reactions: {},
      approved: !state.settings.requireApproval,
      created_at: new Date(),
    };

    if (supabase) {
      submitAnecdoteServer(payload, state.settings.requireApproval)
        .then((item) => { if (item) setState(s => ({ ...s, anecdotes: [item, ...s.anecdotes] })); })
        .catch(() => toast({ title: "Envoi échoué", description: "Réessaie dans un instant." }));
    } else {
      setState(s => ({ ...s, anecdotes: [localItem, ...s.anecdotes] }));
    }

    try { localStorage.setItem('lastAuthor', payload.author); } catch {}
    toast({ title: "Anecdote envoyée", description: state.settings.requireApproval ? "Elle sera visible après validation." : "Elle est déjà visible !" });
  };


  const editAnecdote = (id: string, newText: string) => {
    if (supabase) {
      editAnecdoteServer(id, newText, state.settings.requireApproval)
        .catch(() => toast({ title: 'Échec de la modif', description: 'Réessaie.' }));
    }
    setState(s => ({
      ...s,
      anecdotes: s.anecdotes.map(a => {
        if (a.id !== id) return a;
        const nextApproved = s.settings.requireApproval ? false : true;
        return { ...a, text: newText, approved: nextApproved };
      })
    }));
  };



  const react = (id: string, emoji: string, actif: boolean) => {
    if (supabase) { toggleReactionServer(id, emoji).catch(()=>{}); }
    setState(s => ({
      ...s,
      anecdotes: s.anecdotes.map(a => {
        if (a.id !== id) return a;
        const current = a.reactions?.[emoji] ?? 0;
        if(hasReacted(id, emoji) && actif) {
          // OFF
          console.log("unmark");
          unmarkReacted(id, emoji);
          const next = Math.max(0, current - 1);
          const nextReac: Record<string, number> = { ...(a.reactions ?? {}), [emoji]: next };
          if (next === 0) delete nextReac[emoji];
          return { ...a, reactions: nextReac };
        } else if(!hasReacted(id, emoji) && !actif){
          // ON
          console.log("mark");
          markReacted(id, emoji);
          return { ...a, reactions: { ...(a.reactions ?? {}), [emoji]: current + 1 } };
        }
        return { ...a };
      })
    }));
  };



  const approve = (id: string, val: boolean) => {
    if (supabase) { approveServer(id, val).catch(()=>toast({ title: 'Action échouée' })); }
    setState(s => ({ ...s, anecdotes: s.anecdotes.map(a => a.id === id ? { ...a, approved: val } : a) }));
  };

  const remove = (id: string) => {
    if (supabase) { removeServer(id).catch(()=>toast({ title: 'Suppression échouée' })); }
    setState(s => ({ ...s, anecdotes: s.anecdotes.filter(a => a.id !== id) }));
  };

  const resetAll = () => {
    if (!confirm("Tout réinitialiser ?")) return;
    const fresh = loadState();
    fresh.anecdotes = [];
    setState(fresh);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed?.anecdotes) || !parsed?.settings) throw new Error("Format inattendu");
        setState(parsed);
      } catch (e) {
        toast({ title: "Import échoué", description: "Vérifie le fichier." });
      }
    };
    reader.readAsText(file);
  };

  // ---------------- Render ----------------
  return (
    <div suppressHydrationWarning={true} className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-800">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <PartyPopper className="w-6 h-6" />
          <h1 className="font-bold text-xl md:text-2xl flex-1 truncate whitespace-nowrap">
            {state.settings.eventTitle}
          </h1>
          <div className="flex items-center gap-2 ml-2">
            <Button variant={partyMode ? "secondary" : "default"} size="sm" onClick={() => setPartyMode(p => !p)}>
              <Play className="w-4 h-4 mr-1" /> Mode soirée
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm"><Settings className="w-4 h-4 mr-1"/></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Réglages</SheetTitle>
                </SheetHeader>

                {!isAdmin ? (
                  <div className="py-6">
                    <div className="mb-2 text-sm text-slate-600">Entre le PIN pour accéder aux réglages.</div>
                    <PinPrompt onValid={() => setIsAdmin(true)} expected={state.settings.adminPin} />
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="flex justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setIsAdmin(false)}>
                        Se déconnecter
                      </Button>
                    </div>

                    <div className="grid gap-2">
                      <Label>Titre de l’évènement</Label>
                      <Input value={state.settings.eventTitle}
                             onChange={(e) => setState(s => ({...s, settings: {...s.settings, eventTitle: e.target.value}}))} />
                    </div>

                    <div className="grid gap-2">
                      <Label>Date affichée</Label>
                      <Input value={state.settings.eventDate}
                             onChange={(e) => setState(s => ({...s, settings: {...s.settings, eventDate: e.target.value}}))} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border">
                      <div>
                        <div className="font-medium">Validation avant publication</div>
                        <div className="text-sm text-slate-500">Si activé, un admin doit approuver chaque anecdote.</div>
                      </div>
                      <Switch checked={state.settings.requireApproval}
                              onCheckedChange={(v) => setState(s => ({...s, settings: {...s.settings, requireApproval: v}}))} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border">
                      <div>
                        <div className="font-medium">Afficher les auteurs</div>
                        <div className="text-sm text-slate-500">Réservé à l’admin.</div>
                      </div>
                      <Switch checked={showAuthors}
                              onCheckedChange={(v) => { setShowAuthors(v); setState(s => ({...s, settings: { ...s.settings, showAuthorsByDefault: v }})); }} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>PIN admin</Label>
                        <Input type="password" value={state.settings.adminPin}
                               onChange={(e) => setState(s => ({...s, settings: {...s.settings, adminPin: e.target.value}}))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Rotation (sec)</Label>
                        <Input type="number" min={3} value={state.settings.rotateSeconds}
                               onChange={(e) => setState(s => ({...s, settings: {...s.settings, rotateSeconds: Number(e.target.value || 10)}}))} />
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-3">
                      <div className="font-medium">Import / Export</div>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => exportJSON(state, "anecdotes.json")}><Download className="w-4 h-4 mr-1"/>Export JSON</Button>
                        <Button variant="outline" size="sm" onClick={() => exportCSV(state.anecdotes, "anecdotes.csv")}><Download className="w-4 h-4 mr-1"/>Export CSV</Button>
                        <label className="inline-flex items-center">
                          <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files && importJSON(e.target.files[0])} />
                          <Button variant="outline" size="sm"><Upload className="w-4 h-4 mr-1"/>Import JSON</Button>
                        </label>
                        <Button variant="destructive" size="sm" onClick={resetAll}>Réinitialiser</Button>
                      </div>
                    </div>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {partyMode ? (
          // ---- MODE SOIRÉE: uniquement le diaporama + réactions ----
          partyItems.length === 0 ? (
            <p className="text-center text-slate-500">Ajoutez des anecdotes pour lancer le diaporama.</p>
          ) : (
            <PartyCarousel items={partyItems} index={currentIndex} setIndex={setCurrentIndex} showAuthor={showAuthors} seconds={state.settings.rotateSeconds} onReact={react} />
          )
        ) : (
          <>
            {/* Soumission */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5"/>Raconte une anecdote !</CardTitle>
                <CardDescription>Partage un souvenir drôle ou mémorable (30–600 caractères).</CardDescription>
              </CardHeader>
              <CardContent>
                <SubmitForm onSubmit={submitAnecdote} />
              </CardContent>
            </Card>
            {/* Liste + Diaporama + Admin */}
            <Tabs defaultValue="list" className="mb-10">
              <TabsList>
                <TabsTrigger value="list">Anecdotes</TabsTrigger>
                <TabsTrigger value="top">Classement</TabsTrigger>
                <TabsTrigger value="party">Diaporama</TabsTrigger>
                {isAdmin && <TabsTrigger value="admin">Modération</TabsTrigger>}
              </TabsList>

              <TabsContent value="list" className="mt-4">

                {/* Barre d’outils (plus de filtre catégorie; œil seulement en admin) */}
                <div className="flex flex-col md:flex-row gap-3 md:items-center mb-4">
                  <div className="flex-1"/>
                  <Select value={String(minReactions)} onValueChange={(v) => setMinReactions(Number(v))}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filtrer par réactions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Toutes (0+)</SelectItem>
                      <SelectItem value="1">1+ réactions</SelectItem>
                      <SelectItem value="3">3+ réactions</SelectItem>
                      <SelectItem value="5">5+ réactions</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {meAuthor && (
                    <div className="flex items-center gap-2">
                      <Switch checked={onlyMine} onCheckedChange={setOnlyMine} id="only-mine" />
                      <Label suppressHydrationWarning={true} htmlFor="only-mine" className="text-sm">Mes anecdotes</Label>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Switch checked={noMyReactions} onCheckedChange={setNoMyReactions} id="no-my-react" />
                    <Label htmlFor="no-my-react" className="text-sm">Sans mes réactions</Label>
                  </div>
    
                  <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:w-72"/>
                  {isAdmin && (
                    <Button variant="outline" size="icon" onClick={() => setShowAuthors(s => !s)} title={showAuthors ? "Masquer auteurs" : "Afficher auteurs"}>
                      {showAuthors ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </Button>
                  )}
                </div>
                
                {filteredAnecdotes.length === 0 ? (
                  <p className="text-center text-slate-500">Aucune anecdote pour l’instant. Sois le·la premier·ère !</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4" >
                    {filteredAnecdotes.map(a => (
                      <AnecdoteCard key={a.id} a={a} showAuthor={showAuthors} onReact={react} onEdit={editAnecdote} showClassment={false} classment={-1} anecdotes={state.anecdotes}/>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="top" className="mt-4">
                {leaderboard.length === 0 ? (
                  <p className="text-center text-slate-500">Aucune anecdote pour le moment.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {leaderboard.map((a, idx) => (
                        <AnecdoteCard key={a.id} a={a} showAuthor={showAuthors} onReact={react} onEdit={editAnecdote} showClassment={true} classment={idx} anecdotes={state.anecdotes}/>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="party" className="mt-4">
                {partyItems.length === 0 ? (
                  <p className="text-center text-slate-500">Ajoute des anecdotes pour lancer le diaporama.</p>
                ) : (
                  <PartyCarousel items={partyItems} index={currentIndex} setIndex={setCurrentIndex} showAuthor={showAuthors} seconds={state.settings.rotateSeconds} onReact={react} />
                )}
              </TabsContent>

              {isAdmin && (
                <TabsContent value="admin" className="mt-4">
                  <AdminPanel items={state.anecdotes} onApprove={approve} onRemove={remove} requireApproval={state.settings.requireApproval} />
                </TabsContent>
              )}
            </Tabs>

            <ShareHint />
          </>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 pb-10 text-center text-xs text-slate-400">
        Fait avec ❤️ pour une soirée mémorable.
      </footer>
    </div>
  );
}

// ---------------- Components ----------------
function SubmitForm({ onSubmit }: { onSubmit: (payload: { text: string; author: string }) => void }) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const valid = text.trim().length >= 30 && text.trim().length <= 600 && author.trim().length >= 2;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({ text: text.trim(), author: author.trim() });
        setText(""); setAuthor("");
      }}
    >
      <div className="grid gap-2">
        <Label>Ton anecdote</Label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex: Un jour, à 3h du matin, il a…" rows={4} />
        <div className="text-xs text-slate-500 text-right">{text.trim().length}/600</div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="grid gap-2 md:col-span-2">
          <Label>Ton prénom (ou pseudo)</Label>
          {/* Input + suggestions, mais saisie libre possible */}
          <Input list="guest-list" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Prénom" />
          <datalist id="guest-list">
            {INVITES.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!valid}><Plus className="w-4 h-4 mr-1"/>Envoyer</Button>
        {!valid && <span className="text-xs text-slate-500">30–600 caractères, prénom requis.</span>}
      </div>
    </form>
  );
}

function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  return mounted;
}


function ReactionBar({ a, onReact }: { a: Anecdote; onReact: (id: string, emoji: string, actif: boolean) => void }) {
  const mounted = useMounted(); // false pendant SSR / 1er pass client
  return (
    <div className="flex flex-wrap items-center gap-2">
      {EMOJIS.map((e) => {
        const active = mounted ? hasReacted(a.id, e) : false; // garantit le même HTML qu'en SSR
        return (
          <Button
            key={e}
            variant={active ? "default" : "secondary"}
            size="sm"
            onClick={() => {onReact(a.id, e, active)}} 
            title={active ? "Retirer la réaction" : "Ajouter une réaction"}
          >
            <span className="mr-1">{e}</span>{a.reactions?.[e] ?? 0}
          </Button>
        );
      })}
    </div>
  );
}

function AnecdoteCard({ a, showAuthor, onReact, onEdit, showClassment, classment, anecdotes }: { a: Anecdote; showAuthor: boolean; onReact: (id: string, emoji: string, actif: boolean) => void; onEdit: (id: string, newText: string) => void; showClassment: boolean; classment: number; anecdotes : Anecdote[] }) {
console.log(a);
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        {!a.approved && (
          <Badge style={{backgroundColor: '#ffe4eb', color: '#c40034'}}>Pas encore approuvé</Badge>
        )}
        {showClassment && (
          <div className="flex items-center justify-between mb-1">
            <Badge variant="secondary">#{classment + 1}</Badge>
            <Badge>{totalReactions(a)} réactions</Badge>
          </div>
        )}
        {!showClassment && (
          <div className="flex items-center gap-2">
            <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
              <span suppressHydrationWarning>{new Date(a.created_at).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}</span>
            </div>
          </div>
        )}
        <CardTitle className="text-base font-medium leading-6">{a.text}</CardTitle>
        <CardDescription>
          {showAuthor ? <>par <strong>{a.author}</strong></> : <span className="italic text-slate-400">Auteur caché</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <ReactionBar a={a} onReact={onReact} />
          {!showClassment && (
            <EditOwnAnecdote a={a} onEdit={onEdit} />
          )}
          {!showClassment && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Deviner l’auteur</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Qui a écrit cette anecdote ?</DialogTitle>
                  <DialogDescription>Fais une hypothèse dans la liste.</DialogDescription>
                </DialogHeader>
                <GuessAndReveal a={a} showAuthor={showAuthor} anecdotes={anecdotes}/>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EditOwnAnecdote({ a, onEdit }: { a: Anecdote; onEdit: (id: string, newText: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(a.text);
  const last = (() => { try { return localStorage.getItem('lastAuthor') || ""; } catch { return ""; } })();
  const canEdit = last && last.toLowerCase() === a.author.toLowerCase();

  if (!canEdit) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Modifier</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier ton anecdote</DialogTitle>
          <DialogDescription>
            {`En enregistrant, elle repart en validation si la modération est activée.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Textarea rows={5} value={text} onChange={(e)=>setText(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={()=>{ onEdit(a.id, text.trim()); setOpen(false); }}>Enregistrer</Button>
            <Button variant="outline" onClick={()=>setOpen(false)}>Annuler</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GuessAndReveal({ a, showAuthor, anecdotes }: { a: Anecdote; showAuthor: boolean; anecdotes : Anecdote[] }) {
  const [guess, setGuess] = useState<string>(INVITES[0] ?? "");
  const [revealed, setRevealed] = useState<boolean>(showAuthor);
  const correct = guess.trim().toLowerCase() === a.author.toLowerCase();
  const allNamesSorted = Array.from(new Set([
    ...anecdotes.map(a => a.author?.trim()).filter(Boolean),
    ...INVITES
  ])).sort();
  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label>Ton pronostic</Label>
        <Select value={guess} onValueChange={setGuess}>
          <SelectTrigger>
            <SelectValue placeholder="Choisis un invité" />
          </SelectTrigger>
          <SelectContent>
            {allNamesSorted.map(n => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => setRevealed(true)}>Révéler</Button>
        {revealed && (<Badge variant="secondary">{a.author}</Badge>)}
      </div>
      {revealed && (
        <div className={classNames("text-sm", correct ? "text-green-600" : "text-slate-500")}>{correct ? "Bien vu !" : "Raté, mais joli essai 😉"}</div>
      )}
    </div>
  );
}

function PartyCarousel({ items, index, setIndex, showAuthor, seconds, onReact }: { items: Anecdote[]; index: number; setIndex: (v: number) => void; showAuthor: boolean; seconds: number; onReact: (id: string, emoji: string, actif: boolean) => void; }) {
  const a = items[index];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((index + 1) % items.length);
      if (e.key === "ArrowLeft") setIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, setIndex]);

  if (!a) return null;

  return (
    <div ref={containerRef} className="rounded-3xl border p-8 md:p-12 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-slate-500">{items.length ? index + 1 : 0} / {items.length}</div>
      </div>
      <blockquote className="text-2xl md:text-3xl leading-relaxed font-medium mb-6">“{a.text}”</blockquote>
      <div className="text-right text-slate-600">
        {showAuthor ? <>— <strong>{a.author}</strong></> : <span className="italic text-slate-400">Auteur caché</span>}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={() => setIndex((index - 1 + items.length) % items.length)}>Précédent</Button>
        <Button onClick={() => setIndex((index + 1) % items.length)}>Suivant</Button>
      </div>
      <div className="mt-6">
        <ReactionBar a={a} onReact={onReact} />
      </div>
    </div>
  );
}

function AdminPanel({ items, onApprove, onRemove, requireApproval }: { items: Anecdote[]; onApprove: (id: string, v: boolean) => void; onRemove: (id: string) => void; requireApproval: boolean; }) {
  const pending = items.filter(a => !a.approved);
  const approved = items.filter(a => a.approved);

  return (
    <div className="grid gap-6">
      {requireApproval && (
        <section>
          <h3 className="font-semibold mb-3">En attente ({pending.length})</h3>
          {pending.length === 0 ? <p className="text-sm text-slate-500">Rien à modérer.</p> : (
            <div className="grid md:grid-cols-2 gap-3">
              {pending.map(a => (
                <Card key={a.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{a.text}</CardTitle>
                    <CardDescription>{a.author}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => onApprove(a.id, true)}>Approuver</Button>
                      <Button variant="destructive" onClick={() => onRemove(a.id)}>Supprimer</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h3 className="font-semibold mb-3">Publié ({approved.length})</h3>
        {approved.length === 0 ? <p className="text-sm text-slate-500">Aucune publication.</p> : (
          <div className="grid md:grid-cols-2 gap-3">
            {approved.map(a => (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="text-base">{a.text}</CardTitle>
                  <CardDescription>{a.author}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => onApprove(a.id, false)}>Dépublier</Button>
                    <Button variant="destructive" onClick={() => onRemove(a.id)}>Supprimer</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PinPrompt({ expected, onValid }: { expected: string; onValid: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (pin === expected) onValid(); else setError("PIN incorrect"); }} className="grid gap-3">
      <Input type="password" placeholder="PIN" value={pin} onChange={(e) => { setPin(e.target.value); setError(""); }} />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <Button type="submit">Entrer</Button>
    </form>
  );
}

function ShareHint() {
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); }
      else { await navigator.clipboard.writeText(url); alert("Lien copié dans le presse-papier !"); }
    } catch {}
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Share2 className="w-4 h-4"/>Inviter les invités</CardTitle>
        <CardDescription>Partage le lien ou affiche un QR code imprimé.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Button onClick={share}>Partager le lien</Button>
          <QRCodeButton />
        </div>
      </CardContent>
    </Card>
  );
}

function QRCodeButton() {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0,0,512,512);
    ctx.fillStyle = "#f1f5f9"; ctx.fillRect(0,0,512,512);
    ctx.fillStyle = "#0f172a"; ctx.font = "20px sans-serif";
    const url = window.location.href;
    wrapText(ctx, url, 20, 40, 472, 26);
    ctx.strokeStyle = "#0f172a"; ctx.strokeRect(0,0,512,512);
  }, [open]);
  const download = () => { const canvas = canvasRef.current; if (!canvas) return; const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = "qr-code.png"; a.click(); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">QR code</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR code</DialogTitle>
          <DialogDescription>Astuce: remplace ce QR factice par la lib <code>qrcode</code> si tu déploies.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <canvas ref={canvasRef} width={512} height={512} className="rounded-xl border"/>
          <Button onClick={download}><Download className="w-4 h-4 mr-1"/>Télécharger</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) { ctx.fillText(line, x, y); line = words[n] + " "; y += lineHeight; }
    else { line = testLine; }
  }
  ctx.fillText(line, x, y);
}

// ---------------- Lightweight Runtime Tests ----------------
console.assert(Array.isArray(INVITES) && INVITES.includes("David"), "INVITES should include David");
(function testAddReactionPure(){
  const a:Anecdote = { id:"t1", text:"x", author:"y", approved:true, created_at:new Date(), reactions:{} };
  const emoji = "👍"; const before = a.reactions?.[emoji] ?? 0; a.reactions = { ...a.reactions, [emoji]: (a.reactions?.[emoji] ?? 0) + 1 };
  console.assert((a.reactions?.[emoji] ?? 0) === before + 1, "Reaction increment failed");
})();
