"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { backendApiUrl, backendRequest, hasSession, signOut } from "@/lib/backend-api";

type TabId = "logs" | "health" | "audit" | "files";
type LogEntry = {
  id: string;
  time: string;
  level: string;
  msg?: string;
  source?: string;
  requestId?: string;
  durationMs?: number;
  res?: { statusCode?: number };
  statusCode?: number;
  route?: string;
  userId?: string;
  err?: { message?: string; stack?: string; type?: string };
  [key: string]: unknown;
};
type LogsResponse = { items: LogEntry[]; hasMore: boolean; nextBefore: string | null };
type MinuteStat = { minute: string; requests: number; errors: number; clientErrors: number; slow: number; avgMs: number };
type Health = {
  version: string; node: string; environment: string; pid: number; uptimeSeconds: number; startedAt: string;
  memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
  system: { loadAverage: number[]; freeMemoryMb: number; totalMemoryMb: number };
  database: { ok: boolean; latencyMs?: number; error?: string };
  logs: { directory: string; fileLogging: boolean; fileError: string | null; directoryFromEnv: boolean; files: number; totalSizeMb: number; retentionDays: number; maxFileSize: string; level: string };
  integrations: { sms: string; whatsapp: string; alertEmails: string; frontendIngestKey: boolean };
  requests: { series: MinuteStat[]; last15: Summary; last60: Summary };
  slowRequestMs: number;
};
type Summary = { requests: number; errors: number; clientErrors: number; slow: number; avgMs: number; errorRate: number };
type AuditItem = { id: string; action: string; entityType: string; entityId: string | null; metadata: string | null; ip: string | null; actorLabel: string; actorEmail: string | null; actorName: string | null; createdAt: string };
type LogFile = { name: string; size: number; modifiedAt: string; compressed: boolean };

const TABS: { id: TabId; label: string }[] = [
  { id: "logs", label: "Logs" },
  { id: "health", label: "Santé du serveur" },
  { id: "audit", label: "Journal d'audit" },
  { id: "files", label: "Fichiers de log" },
];
const PERIODS = [
  { id: "1h", label: "1 heure", ms: 3600e3 },
  { id: "24h", label: "24 heures", ms: 86400e3 },
  { id: "7d", label: "7 jours", ms: 7 * 86400e3 },
  { id: "14d", label: "14 jours", ms: 14 * 86400e3 },
];
// Couleurs d'état (réservées) : toujours accompagnées du libellé du niveau.
const LEVEL_STYLES: Record<string, string> = {
  fatal: "bg-[#a13b2f] text-white",
  error: "bg-[#f6e6e3] text-[#a13b2f]",
  warn: "bg-[#f6efdf] text-[#8a5d12]",
  info: "bg-[#eeeae6] text-[#4a443e]",
  debug: "bg-[#f3f1ef] text-[#6b645d]",
  trace: "bg-[#f3f1ef] text-[#6b645d]",
};
const SOURCE_LABELS: Record<string, string> = { backend: "API", "frontend-browser": "Navigateur", "frontend-server": "Serveur Next" };
const AUDIT_PAGE_SIZE = 12;
const LIVE_INTERVAL_MS = 5000;

const formatTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const formatBytes = (bytes: number) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);
const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days} j ${hours} h` : hours ? `${hours} h ${minutes} min` : `${minutes} min`;
};
const statusOf = (entry: LogEntry) => entry.res?.statusCode ?? entry.statusCode;

/** Garde d'accès : écran réservé au rôle DEV (équipe technique). */
export function SupervisionDashboard() {
  const loginHref = usePathname().startsWith("/en") ? "/en/compte/connexion" : "/fr/compte/connexion";
  const [access, setAccess] = useState<"checking" | "granted" | "denied">("checking");
  const [user, setUser] = useState<{ name: string | null; email: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (hasSession() ? backendRequest<{ user: { role: string; name: string | null; email: string | null } }>("/auth/me") : Promise.reject(new Error("no session")))
      .then(({ user: me }) => {
        if (cancelled) return;
        setUser(me);
        setAccess(me.role === "DEV" ? "granted" : "denied");
      })
      .catch(() => { if (!cancelled) setAccess("denied"); });
    return () => { cancelled = true; };
  }, []);

  if (access === "checking") return <main className="grid min-h-screen place-items-center text-sm text-[#8a8378]">Vérification de l’accès…</main>;
  if (access === "denied") {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="mb-2 text-xl font-semibold">Supervision réservée à l’équipe technique</h1>
          <p className="mb-4 text-sm text-[#8a8378]">Connectez-vous avec un compte disposant du rôle DEV.</p>
          <Link href={loginHref} className="rounded bg-[#14120F] px-4 py-2 text-sm font-semibold text-white">Se connecter</Link>
        </div>
      </main>
    );
  }
  return <SupervisionContent user={user} loginHref={loginHref} />;
}

function SupervisionContent({ user, loginHref }: { user: { name: string | null; email: string | null } | null; loginHref: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("logs");
  const logout = async () => {
    await signOut();
    router.push(loginHref);
  };
  return (
    <div className="h-screen overflow-hidden bg-[#FCF7F8] text-[#14120F]" style={{ fontFamily: "var(--font-archivo), sans-serif" }}>
      <div className="flex h-full">
        <aside className="hidden w-[210px] shrink-0 flex-col bg-black text-[#FCF7F8] md:flex">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="text-[17px] font-semibold">KEMI<span className="text-[#D2531E]">·</span>SHOES</div>
            <div className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/45">Supervision · équipe technique</div>
          </div>
          <nav className="px-2.5 py-3.5">
            {TABS.map((item) => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`mb-0.5 flex w-full rounded-[5px] px-3 py-2.5 text-left text-[12.5px] ${tab === item.id ? "bg-[#D2531E] font-bold text-white" : "text-white/70 hover:bg-white/10"}`}>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto border-t border-white/10 px-5 py-3.5 text-[11px] text-white/50">
            <div className="truncate">{user?.name ?? user?.email}</div>
            <button type="button" onClick={() => void logout()} className="mt-1 underline">Se déconnecter</button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 overflow-x-auto border-b border-[#E4DDD5] bg-white px-4 py-3 md:hidden">
            {TABS.map((item) => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`shrink-0 rounded px-3 py-1.5 text-[12px] ${tab === item.id ? "bg-[#14120F] text-white" : "border border-[#E4DDD5]"}`}>{item.label}</button>
            ))}
          </header>
          <main className="flex min-h-0 flex-1 flex-col p-5 lg:p-6">
            {tab === "logs" && <LogsPanel />}
            {tab === "health" && <HealthPanel />}
            {tab === "audit" && <AuditPanel />}
            {tab === "files" && <FilesPanel />}
          </main>
        </div>
      </div>
    </div>
  );
}

function PanelTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[21px] tracking-[-0.01em]">{title}</h1>
        {subtitle && <div className="mt-1 text-[12px] text-[#8a8378]">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

const inputClass = "rounded-[6px] border border-[#E4DDD5] bg-white px-2.5 py-1.5 text-[12px]";
const buttonClass = "rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50";

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

function LogsPanel() {
  const [filters, setFilters] = useState({ level: "", source: "", period: "24h", status: "", q: "", requestId: "", slow: false });
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const filtersRef = useRef(filters);
  // Synchronisé après rendu : les fonctions de chargement lisent toujours les derniers filtres.
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const buildQuery = useCallback((extra: Record<string, string>) => {
    const current = filtersRef.current;
    const params = new URLSearchParams({ limit: "100", ...extra });
    const period = PERIODS.find((item) => item.id === current.period);
    if (period && !extra.after) params.set("from", new Date(Date.now() - period.ms).toISOString());
    if (current.level) params.set("level", current.level);
    if (current.source) params.set("source", current.source);
    if (current.status) params.set("status", current.status);
    if (current.q.trim()) params.set("q", current.q.trim());
    if (current.requestId.trim()) params.set("requestId", current.requestId.trim());
    if (current.slow) params.set("slowMs", "1000");
    return params.toString();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await backendRequest<LogsResponse>(`/monitoring/logs?${buildQuery({})}`);
      setEntries(result.items);
      setHasMore(result.hasMore);
      setNextBefore(result.nextBefore);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const loadMore = async () => {
    if (!nextBefore) return;
    setLoading(true);
    try {
      const result = await backendRequest<LogsResponse>(`/monitoring/logs?${buildQuery({ before: nextBefore })}`);
      setEntries((current) => [...current, ...result.items]);
      setHasMore(result.hasMore);
      setNextBefore(result.nextBefore);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Suivi en direct : nouvelles entrées postérieures à la plus récente affichée.
  const newestRef = useRef<string | undefined>(undefined);
  useEffect(() => { newestRef.current = entries[0]?.time; }, [entries]);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(async () => {
      const after = newestRef.current ?? new Date(Date.now() - 60e3).toISOString();
      try {
        const result = await backendRequest<LogsResponse>(`/monitoring/logs?${buildQuery({ after })}`);
        if (result.items.length) setEntries((current) => [...result.items, ...current].slice(0, 500));
      } catch {
        /* nouvel essai au prochain intervalle */
      }
    }, LIVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [live, buildQuery]);

  const update = (patch: Partial<typeof filters>) => setFilters((current) => ({ ...current, ...patch }));
  const errorCount = entries.filter((entry) => entry.level === "error" || entry.level === "fatal").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelTitle title="Logs" subtitle={`${entries.length} entrée(s) affichée(s)${errorCount ? ` · ${errorCount} erreur(s)` : ""}`}>
        <label className="flex items-center gap-2 text-[12px] font-semibold">
          <input type="checkbox" checked={live} onChange={(event) => setLive(event.target.checked)} />
          Suivi en direct {live && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#3f6b4a]" aria-label="actif" />}
        </label>
      </PanelTitle>
      <form className="mb-3 flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <select aria-label="Niveau minimal" className={inputClass} value={filters.level} onChange={(event) => update({ level: event.target.value })}>
          <option value="">Tous niveaux</option><option value="info">info et +</option><option value="warn">warn et +</option><option value="error">error et +</option><option value="fatal">fatal</option>
        </select>
        <select aria-label="Source" className={inputClass} value={filters.source} onChange={(event) => update({ source: event.target.value })}>
          <option value="">Toutes sources</option><option value="backend">API</option><option value="frontend-server">Serveur Next</option><option value="frontend-browser">Navigateur</option>
        </select>
        <select aria-label="Période" className={inputClass} value={filters.period} onChange={(event) => update({ period: event.target.value })}>
          {PERIODS.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}
        </select>
        <select aria-label="Statut HTTP" className={inputClass} value={filters.status} onChange={(event) => update({ status: event.target.value })}>
          <option value="">Tous statuts</option><option value="5xx">5xx</option><option value="4xx">4xx</option><option value="2xx">2xx</option>
        </select>
        <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={filters.slow} onChange={(event) => update({ slow: event.target.checked })} />Lentes (&gt; 1 s)</label>
        <input aria-label="Recherche" className={`${inputClass} w-44`} placeholder="Texte (message, URL…)" value={filters.q} onChange={(event) => update({ q: event.target.value })} />
        <input aria-label="Référence" className={`${inputClass} w-44 font-mono`} placeholder="Référence (requestId)" value={filters.requestId} onChange={(event) => update({ requestId: event.target.value })} />
        <button type="submit" className="rounded-[6px] bg-[#14120F] px-3 py-1.5 text-[12px] font-semibold text-white" disabled={loading}>{loading ? "…" : "Rechercher"}</button>
      </form>
      {error && <p role="alert" className="mb-2 text-[12px] text-[#a13b2f]">{error}</p>}
      <div className="min-h-0 flex-1 overflow-auto rounded-[10px] border border-[#E4DDD5] bg-white">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-[#F3ECE6] text-left text-[10.5px] uppercase tracking-wider text-[#8a8378]">
            <tr><th className="px-3 py-2">Heure</th><th className="px-3 py-2">Niveau</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Durée</th><th className="px-3 py-2">Référence</th></tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} onClick={() => setSelected(entry)} className="cursor-pointer border-t border-[#F0EAE4] hover:bg-[#FCF7F8]">
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-[#6b645d]">{formatTime(entry.time)}</td>
                <td className="px-3 py-1.5"><span className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${LEVEL_STYLES[entry.level] ?? LEVEL_STYLES.info}`}>{entry.level}</span></td>
                <td className="whitespace-nowrap px-3 py-1.5 text-[11px]">{SOURCE_LABELS[entry.source ?? "backend"] ?? entry.source}</td>
                <td className="max-w-[520px] truncate px-3 py-1.5" title={entry.msg}>{entry.msg}{entry.err?.message && entry.err.message !== entry.msg ? ` — ${entry.err.message}` : ""}</td>
                <td className="px-3 py-1.5 font-mono text-[11px]">{statusOf(entry) ?? ""}</td>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px]">{entry.durationMs !== undefined ? `${Math.round(entry.durationMs)} ms` : ""}</td>
                <td className="px-3 py-1.5">
                  {entry.requestId && (
                    <button type="button" className="font-mono text-[11px] text-[#D2531E] underline" title="Filtrer sur cette requête" onClick={(event) => { event.stopPropagation(); update({ requestId: entry.requestId ?? "" }); filtersRef.current = { ...filtersRef.current, requestId: entry.requestId ?? "" }; void load(); }}>
                      {entry.requestId.slice(0, 8)}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!entries.length && !loading && <tr><td colSpan={7} className="px-3 py-8 text-center text-[#8a8378]">Aucune entrée pour ces filtres.</td></tr>}
          </tbody>
        </table>
        {hasMore && <div className="border-t border-[#F0EAE4] p-2 text-center"><button type="button" className={buttonClass} onClick={() => void loadMore()} disabled={loading}>Charger les entrées plus anciennes</button></div>}
      </div>
      {selected && <LogDetail entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function LogDetail({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const { id, file, ...rest } = entry;
  const json = JSON.stringify(rest, null, 2);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-label="Détail de l'entrée" className="flex h-full w-full max-w-[560px] flex-col bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#E4DDD5] px-5 py-3">
          <div>
            <div className="text-[13px] font-semibold">{entry.msg}</div>
            <div className="text-[11px] text-[#8a8378]">{formatTime(entry.time)} · {String(file ?? "")} · {id.split(":").pop() && `ligne ${Number(id.split(":").pop()) + 1}`}</div>
          </div>
          <div className="flex gap-2">
            <button type="button" className={buttonClass} onClick={() => void navigator.clipboard?.writeText(json)}>Copier</button>
            <button type="button" className={buttonClass} onClick={onClose}>Fermer</button>
          </div>
        </div>
        {entry.err?.stack && (
          <div className="border-b border-[#E4DDD5] px-5 py-3">
            <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#8a8378]">Pile d’appels</div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-[11px] text-[#a13b2f]">{entry.err.stack}</pre>
          </div>
        )}
        <pre className="min-h-0 flex-1 overflow-auto px-5 py-3 text-[11px]">{json}</pre>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Santé
// ---------------------------------------------------------------------------

function StatusLabel({ level, children }: { level: "good" | "warning" | "critical"; children: React.ReactNode }) {
  const styles = { good: "text-[#3f6b4a]", warning: "text-[#8a5d12]", critical: "text-[#a13b2f]" }[level];
  const icon = { good: "●", warning: "▲", critical: "■" }[level];
  return <span className={`text-[11px] font-semibold ${styles}`}><span aria-hidden="true">{icon}</span> {children}</span>;
}

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#E4DDD5] bg-white p-4">
      <div className="mb-1.5 text-[10.5px] uppercase tracking-wider text-[#8a8378]">{label}</div>
      <div className="text-[22px] font-semibold leading-none tracking-[-0.01em]">{value}</div>
      {children && <div className="mt-2 text-[11.5px] text-[#6b645d]">{children}</div>}
    </div>
  );
}

function HealthPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [asTable, setAsTable] = useState(false);
  const refresh = useCallback(() => {
    backendRequest<Health>("/monitoring/health").then((result) => { setHealth(result); setError(""); }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Chargement impossible."));
  }, []);
  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [refresh]);
  const series = useMemo(() => (health?.requests.series ?? []).map((item) => ({ ...item, label: new Date(item.minute).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) })), [health]);

  if (!health) return <div className="text-[12px] text-[#8a8378]">{error || "Chargement…"}</div>;
  const { last15 } = health.requests;
  const errorLevel = last15.errors === 0 ? "good" : last15.errorRate < 0.02 ? "warning" : "critical";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelTitle title="Santé du serveur" subtitle={`API v${health.version} · Node ${health.node} · ${health.environment} · actualisé toutes les 30 s`}>
        <button type="button" className={buttonClass} onClick={refresh}>Actualiser</button>
      </PanelTitle>
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile label="Disponibilité" value={formatUptime(health.uptimeSeconds)}>Démarré le {formatTime(health.startedAt)} · PID {health.pid}</Tile>
        <Tile label="Base de données" value={health.database.ok ? `${health.database.latencyMs} ms` : "Injoignable"}>
          {health.database.ok ? <StatusLabel level="good">Connectée</StatusLabel> : <StatusLabel level="critical">{health.database.error}</StatusLabel>}
        </Tile>
        <Tile label="Requêtes (15 min)" value={String(last15.requests)}>Durée moyenne {last15.avgMs} ms · {last15.slow} lente(s) (&gt; {health.slowRequestMs} ms)</Tile>
        <Tile label="Erreurs 5xx (15 min)" value={String(last15.errors)}>
          <StatusLabel level={errorLevel}>{last15.errors === 0 ? "Aucune erreur serveur" : `${(last15.errorRate * 100).toFixed(1)} % des requêtes`}</StatusLabel> · {last15.clientErrors} réponse(s) 4xx
        </Tile>
        <Tile label="Mémoire du processus" value={`${health.memory.rssMb} Mo`}>Tas {health.memory.heapUsedMb} / {health.memory.heapTotalMb} Mo · charge {health.system.loadAverage.join(" / ")}</Tile>
        <Tile label="Fichiers de log" value={`${health.logs.totalSizeMb} Mo`}>
          {health.logs.files} fichier(s) · conservation {health.logs.retentionDays} j · rotation quotidienne ou {health.logs.maxFileSize}
          <div className="mt-1 break-all font-mono text-[10.5px]" title="Dossier des logs (LOG_DIR)">{health.logs.directory}</div>
          {!health.logs.fileLogging && <StatusLabel level="critical">Écriture fichier inactive{health.logs.fileError ? ` : ${health.logs.fileError}` : ""}</StatusLabel>}
          {health.logs.fileLogging && !health.logs.directoryFromEnv && <StatusLabel level="warning">LOG_DIR non défini : dossier de l’application</StatusLabel>}
        </Tile>
        <Tile label="Envoi des codes OTP" value={health.integrations.sms === "none" ? "Non branché" : health.integrations.sms}>WhatsApp : {health.integrations.whatsapp}</Tile>
        <Tile label="Alertes e-mail" value={health.integrations.alertEmails}>Erreurs Next remontées : {health.integrations.frontendIngestKey ? "oui (clé configurée)" : "non (LOG_INGEST_KEY absente)"}</Tile>
      </div>
      <div className="flex min-h-0 flex-1 flex-col rounded-[10px] border border-[#E4DDD5] bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13.5px] font-semibold">Requêtes par minute — 60 dernières minutes</h2>
          <button type="button" className={buttonClass} onClick={() => setAsTable((value) => !value)}>{asTable ? "Graphique" : "Tableau"}</button>
        </div>
        {asTable ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-[11.5px]">
              <thead className="sticky top-0 bg-white text-left text-[10.5px] uppercase text-[#8a8378]"><tr><th className="py-1">Minute</th><th>Requêtes</th><th>5xx</th><th>4xx</th><th>Lentes</th><th>Moyenne</th></tr></thead>
              <tbody>{[...series].reverse().filter((item) => item.requests).map((item) => <tr key={item.minute} className="border-t border-[#F0EAE4]"><td className="py-1 font-mono">{item.label}</td><td>{item.requests}</td><td>{item.errors}</td><td>{item.clientErrors}</td><td>{item.slow}</td><td>{item.avgMs} ms</td></tr>)}</tbody>
            </table>
          </div>
        ) : (
          <div className="min-h-[160px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="#F0EAE4" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8a8378" }} tickLine={false} axisLine={{ stroke: "#E4DDD5" }} interval={9} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#8a8378" }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(20,18,15,0.05)" }} content={<MinuteTooltip />} />
                <Bar dataKey="requests" name="Requêtes" fill="#D2531E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function MinuteTooltip({ active, payload }: { active?: boolean; payload?: { payload: MinuteStat & { label: string } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[11.5px] shadow">
      <div className="mb-1 font-semibold">{item.label}</div>
      <div>{item.requests} requête(s) · moyenne {item.avgMs} ms</div>
      <div>{item.errors} erreur(s) 5xx · {item.clientErrors} réponse(s) 4xx · {item.slow} lente(s)</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

function AuditPanel() {
  const [filters, setFilters] = useState({ action: "", actor: "", period: "7d" });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ items: AuditItem[]; total: number }>({ items: [], total: 0 });
  const [error, setError] = useState("");
  const filtersRef = useRef(filters);
  // Synchronisé après rendu : les fonctions de chargement lisent toujours les derniers filtres.
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const load = useCallback(async (targetPage: number) => {
    const current = filtersRef.current;
    const params = new URLSearchParams({ page: String(targetPage), pageSize: String(AUDIT_PAGE_SIZE) });
    const period = PERIODS.find((item) => item.id === current.period);
    if (period) params.set("from", new Date(Date.now() - period.ms).toISOString());
    if (current.action.trim()) params.set("action", current.action.trim());
    if (current.actor.trim()) params.set("actor", current.actor.trim());
    try {
      setResult(await backendRequest(`/monitoring/audit?${params}`));
      setPage(targetPage);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Chargement impossible.");
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(1), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const pageCount = Math.max(1, Math.ceil(result.total / AUDIT_PAGE_SIZE));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelTitle title="Journal d'audit" subtitle={`${result.total} action(s) sensible(s) : connexions, rôles, commandes, produits, contenu, logs`} />
      <form className="mb-3 flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
        <select aria-label="Type d'action" className={inputClass} value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}>
          <option value="">Toutes actions</option><option value="auth.">Connexions et comptes</option><option value="user.">Rôles</option><option value="order.">Commandes</option><option value="product.">Produits</option><option value="delivery_zone.">Zones de livraison</option><option value="settings.">Paramètres</option><option value="content.">Contenu</option><option value="review.">Avis</option><option value="monitoring.">Logs (supervision)</option>
        </select>
        <input aria-label="Acteur" className={`${inputClass} w-52`} placeholder="Acteur (e-mail, rôle…)" value={filters.actor} onChange={(event) => setFilters({ ...filters, actor: event.target.value })} />
        <select aria-label="Période" className={inputClass} value={filters.period} onChange={(event) => setFilters({ ...filters, period: event.target.value })}>
          {PERIODS.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}
        </select>
        <button type="submit" className="rounded-[6px] bg-[#14120F] px-3 py-1.5 text-[12px] font-semibold text-white">Filtrer</button>
      </form>
      {error && <p role="alert" className="mb-2 text-[12px] text-[#a13b2f]">{error}</p>}
      <div className="min-h-0 flex-1 overflow-auto rounded-[10px] border border-[#E4DDD5] bg-white">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-[#F3ECE6] text-left text-[10.5px] uppercase tracking-wider text-[#8a8378]">
            <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Acteur</th><th className="px-3 py-2">Élément</th><th className="px-3 py-2">IP</th><th className="px-3 py-2">Détails</th></tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.id} className="border-t border-[#F0EAE4]">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-[#6b645d]">{formatTime(item.createdAt.replace(" ", "T"))}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{item.action}</td>
                <td className="px-3 py-2">{item.actorEmail ?? item.actorName ?? item.actorLabel}</td>
                <td className="px-3 py-2 text-[11px]">{item.entityType}{item.entityId ? ` · ${item.entityId.slice(0, 8)}` : ""}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{item.ip}</td>
                <td className="max-w-[280px] truncate px-3 py-2 font-mono text-[11px] text-[#6b645d]" title={item.metadata ?? ""}>{item.metadata}</td>
              </tr>
            ))}
            {!result.items.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-[#8a8378]">Aucune action sur cette période.</td></tr>}
          </tbody>
        </table>
      </div>
      {result.total > AUDIT_PAGE_SIZE && (
        <nav aria-label="Pagination" className="mt-2 flex items-center justify-between text-[11.5px] text-[#8a8378]">
          <span>Page {page} / {pageCount}</span>
          <div className="flex gap-1">
            <button type="button" className={buttonClass} disabled={page === 1} onClick={() => void load(page - 1)}>‹ Précédente</button>
            <button type="button" className={buttonClass} disabled={page === pageCount} onClick={() => void load(page + 1)}>Suivante ›</button>
          </div>
        </nav>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fichiers
// ---------------------------------------------------------------------------

function FilesPanel() {
  const [data, setData] = useState<{ files: LogFile[]; current: string | null }>({ files: [], current: null });
  const [days, setDays] = useState("7");
  const [message, setMessage] = useState("");
  const refresh = useCallback(() => {
    backendRequest<{ files: LogFile[]; current: string | null }>("/monitoring/logs/files").then(setData).catch((requestError) => setMessage(requestError instanceof Error ? requestError.message : ""));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const remove = async (name: string) => {
    if (!window.confirm(`Supprimer définitivement ${name} ?`)) return;
    try {
      await backendRequest<void>(`/monitoring/logs/files/${encodeURIComponent(name)}`, { method: "DELETE" });
      setMessage(`${name} supprimé.`);
      refresh();
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Suppression impossible.");
    }
  };
  const purge = async () => {
    const olderThanDays = Number(days);
    if (!olderThanDays || !window.confirm(`Supprimer les fichiers de plus de ${olderThanDays} jour(s) ?`)) return;
    try {
      const result = await backendRequest<{ deleted: string[] }>("/monitoring/logs/purge", { method: "POST", body: JSON.stringify({ olderThanDays }) });
      setMessage(`${result.deleted.length} fichier(s) supprimé(s).`);
      refresh();
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Purge impossible.");
    }
  };
  const total = data.files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelTitle title="Fichiers de log" subtitle={`${data.files.length} fichier(s) · ${formatBytes(total)} · nouveau fichier chaque jour (ou au-delà de la taille maximale), compression puis suppression automatiques après la durée de conservation`}>
        <div className="flex items-center gap-2 text-[12px]">
          <span>Supprimer les fichiers de plus de</span>
          <input aria-label="Ancienneté en jours" type="number" min={1} max={365} className={`${inputClass} w-16`} value={days} onChange={(event) => setDays(event.target.value)} />
          <span>jour(s)</span>
          <button type="button" className={buttonClass} onClick={() => void purge()}>Purger</button>
        </div>
      </PanelTitle>
      {message && <p role="status" className="mb-2 text-[12px] text-[#6b645d]">{message}</p>}
      <div className="min-h-0 flex-1 overflow-auto rounded-[10px] border border-[#E4DDD5] bg-white">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-[#F3ECE6] text-left text-[10.5px] uppercase tracking-wider text-[#8a8378]">
            <tr><th className="px-3 py-2">Fichier</th><th className="px-3 py-2">Taille</th><th className="px-3 py-2">Dernière écriture</th><th className="px-3 py-2">État</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {data.files.map((file) => (
              <tr key={file.name} className="border-t border-[#F0EAE4]">
                <td className="px-3 py-2 font-mono text-[11.5px]">{file.name}</td>
                <td className="px-3 py-2">{formatBytes(file.size)}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{formatTime(file.modifiedAt)}</td>
                <td className="px-3 py-2 text-[11px]">{file.name === data.current ? "En cours d'écriture" : file.name.includes("-fatal") ? "Plantages" : file.compressed ? "Compressé" : "Archivé"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {/* Navigation directe : le cookie de session (SameSite=Lax) accompagne le téléchargement. */}
                  <a className="mr-3 text-[11.5px] font-bold text-[#D2531E]" href={`${backendApiUrl}/monitoring/logs/files/${encodeURIComponent(file.name)}`}>Télécharger</a>
                  <button type="button" className="text-[11.5px] font-bold text-[#a13b2f] disabled:opacity-30" disabled={file.name === data.current} onClick={() => void remove(file.name)}>Supprimer</button>
                </td>
              </tr>
            ))}
            {!data.files.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-[#8a8378]">Aucun fichier de log.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
