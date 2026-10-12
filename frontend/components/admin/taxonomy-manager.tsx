"use client";

import { useCallback, useEffect, useState } from "react";
import { backendRequest } from "@/lib/backend-api";

type Kind = "categories" | "collections";
type Item = { id: string; slug: string; nameFr: string; nameEn: string; descriptionFr?: string | null; active: boolean; productCount: number };

const COPY: Record<Kind, { title: string; singular: string; hint: string; empty: string }> = {
  categories: {
    title: "Catégories",
    singular: "catégorie",
    hint: "Chaque catégorie devient une page de la boutique (/boutique/nom). « Nouveautés » n'est pas listée : elle est automatique (produits ajoutés depuis moins de 14 jours) et disparaît seule quand il n'y en a plus.",
    empty: "Aucune catégorie.",
  },
  collections: {
    title: "Collections",
    singular: "collection",
    hint: "Une collection regroupe des produits choisis dans leur fiche. La section « Nos collections » s'affiche sur l'accueil dès que 3 collections contiennent au moins un produit publié, avec la meilleure vente de chacune.",
    empty: "Aucune collection.",
  },
};

const input = "w-full rounded-[6px] border border-[#E4DDD5] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#D2531E]";

/** Gestion des catégories et des collections de la boutique (ajout, renommage, activation, suppression). */
export function TaxonomyManager({ kind, onChange }: { kind: Kind; onChange?: () => void }) {
  const copy = COPY[kind];
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState({ nameFr: "", nameEn: "", descriptionFr: "" });
  const [drafts, setDrafts] = useState<Record<string, Partial<Item>>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await backendRequest<{ items: Item[] }>(`/${kind}/all`)).items); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Chargement impossible."); }
  }, [kind]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage("");
    try { await action(); await load(); onChange?.(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Action impossible."); }
    finally { setBusy(false); }
  };

  const add = () => {
    if (!form.nameFr.trim()) return setMessage("Indiquez au moins le nom en français.");
    void run(async () => {
      await backendRequest(`/${kind}`, { method: "POST", body: JSON.stringify({ nameFr: form.nameFr.trim(), ...(form.nameEn.trim() ? { nameEn: form.nameEn.trim() } : {}), ...(kind === "collections" && form.descriptionFr.trim() ? { descriptionFr: form.descriptionFr.trim() } : {}) }) });
      setForm({ nameFr: "", nameEn: "", descriptionFr: "" });
    }, `${copy.singular[0].toUpperCase()}${copy.singular.slice(1)} ajoutée.`);
  };

  const patch = (item: Item, changes: Partial<Item>, success = "Modifications enregistrées.") =>
    run(() => backendRequest(`/${kind}/${item.id}`, { method: "PATCH", body: JSON.stringify(changes) }), success).then(() => setDrafts((current) => { const next = { ...current }; delete next[item.id]; return next; }));

  const remove = (item: Item) => {
    if (!window.confirm(`Supprimer « ${item.nameFr} » ?`)) return;
    void run(() => backendRequest(`/${kind}/${item.id}`, { method: "DELETE" }), `${copy.singular[0].toUpperCase()}${copy.singular.slice(1)} supprimée.`);
  };

  return (
    <div className="p-5 lg:p-6">
      <div className="mb-5">
        <h1 className="font-[var(--font-fraunces)] text-[21px] font-semibold tracking-[-0.01em]">{copy.title}</h1>
        <p className="mt-1 max-w-[720px] text-[12px] leading-relaxed text-[#8a8378]">{copy.hint}</p>
      </div>

      <div className="mb-4 rounded-[10px] border border-[#E4DDD5] bg-white p-4">
        <div className="mb-3 text-[13px] font-semibold">Ajouter une {copy.singular}</div>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <input className={input} value={form.nameFr} placeholder="Nom (français)" onChange={(event) => setForm({ ...form, nameFr: event.target.value })} />
          <input className={input} value={form.nameEn} placeholder="Nom (anglais, optionnel)" onChange={(event) => setForm({ ...form, nameEn: event.target.value })} />
          <button type="button" disabled={busy} onClick={add} className="rounded-[6px] bg-[#D2531E] px-4 py-2 text-[12.5px] font-bold text-white hover:bg-[#A83E14] disabled:opacity-50">Ajouter</button>
        </div>
        {kind === "collections" && <input className={`${input} mt-2`} value={form.descriptionFr} placeholder="Description courte (optionnelle)" onChange={(event) => setForm({ ...form, descriptionFr: event.target.value })} />}
      </div>

      {message && <p className="mb-3 text-[12px] text-[#8a8378]" role="status">{message}</p>}

      <div className="grid gap-3">
        {items.length === 0 && <p className="rounded-[10px] border border-dashed border-[#E4DDD5] p-6 text-center text-[12.5px] text-[#8a8378]">{copy.empty}</p>}
        {items.map((item) => {
          const draft = { ...item, ...drafts[item.id] };
          const dirty = Boolean(drafts[item.id]);
          const edit = (changes: Partial<Item>) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], ...changes } }));
          return (
            <div key={item.id} className="rounded-[10px] border border-[#E4DDD5] bg-white p-4">
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-center">
                <input className={input} aria-label="Nom (français)" value={draft.nameFr} onChange={(event) => edit({ nameFr: event.target.value })} />
                <input className={input} aria-label="Nom (anglais)" value={draft.nameEn} onChange={(event) => edit({ nameEn: event.target.value })} />
                <label className="flex items-center gap-2 text-[12px] font-semibold">
                  <input type="checkbox" checked={draft.active} onChange={(event) => edit({ active: event.target.checked })} /> Visible
                </label>
              </div>
              {kind === "collections" && <input className={`${input} mt-2`} aria-label="Description" value={draft.descriptionFr ?? ""} placeholder="Description courte" onChange={(event) => edit({ descriptionFr: event.target.value })} />}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#8a8378]">
                <span>/{kind === "categories" ? "boutique" : "collections"}/<b className="text-[#14120F]">{item.slug}</b> · {item.productCount} produit{item.productCount > 1 ? "s" : ""}</span>
                <span className="flex gap-2">
                  {dirty && <button type="button" disabled={busy} onClick={() => void patch(item, { nameFr: draft.nameFr, nameEn: draft.nameEn, active: draft.active, ...(kind === "collections" ? { descriptionFr: draft.descriptionFr ?? undefined } : {}) })} className="rounded-[6px] bg-[#14120F] px-3 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-50">Enregistrer</button>}
                  <button type="button" disabled={busy} onClick={() => remove(item)} className="rounded-[6px] border border-[#E4DDD5] px-3 py-1.5 text-[11.5px] font-semibold text-[#a13b2f] disabled:opacity-50">Supprimer</button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
