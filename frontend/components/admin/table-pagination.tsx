"use client";

import { useState } from "react";

/** Nombre de lignes par page : un tableau tient dans le viewport (1366×900). */
export const ADMIN_PAGE_SIZE = 8;

/**
 * Pagination côté client d'une liste déjà chargée. La page courante est bornée
 * au nombre de pages (une suppression ou un filtre ne laisse pas une page vide).
 */
export function usePagination<T>(items: T[], pageSize = ADMIN_PAGE_SIZE) {
  const [requestedPage, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * pageSize;
  return { page, pageCount, setPage, pageItems: items.slice(start, start + pageSize), start, total: items.length, pageSize };
}

type Pagination = Pick<ReturnType<typeof usePagination>, "page" | "pageCount" | "setPage" | "start" | "total" | "pageSize">;

export function TablePagination({ pagination, label = "éléments" }: { pagination: Pagination; label?: string }) {
  const { page, pageCount, setPage, start, total, pageSize } = pagination;
  if (total <= pageSize) return null;
  const buttonClass = "min-w-[28px] rounded-[5px] border border-[#E4DDD5] px-2 py-1 text-[11.5px] font-semibold disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-[#E4DDD5] px-[14px] py-[10px] text-[11.5px] text-[#8a8378]">
      <span>
        {start + 1}–{Math.min(start + pageSize, total)} sur {total} {label}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className={buttonClass} disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Page précédente">‹</button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => setPage(number)}
            aria-current={number === page ? "page" : undefined}
            className={`${buttonClass} ${number === page ? "border-[#D2531E] bg-[#D2531E] text-white" : "bg-white text-[#14120F]"}`}
          >
            {number}
          </button>
        ))}
        <button type="button" className={buttonClass} disabled={page === pageCount} onClick={() => setPage(page + 1)} aria-label="Page suivante">›</button>
      </div>
    </nav>
  );
}
