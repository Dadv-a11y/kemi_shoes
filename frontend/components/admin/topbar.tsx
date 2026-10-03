"use client";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-7 py-3.5 border-b border-border bg-white">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="hidden lg:hidden text-ink cursor-pointer text-lg"
        >
          ☰
        </button>
        <input
          type="text"
          placeholder="🔍 Rechercher…"
          className="w-[260px] border border-border rounded-[6px] px-3.5 py-2 text-[12.5px] text-muted focus:outline-none focus:border-terracotta"
        />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-base relative cursor-pointer">
          🔔
          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-terracotta" />
        </span>
        <div className="w-[30px] h-[30px] rounded-full bg-ink text-white flex items-center justify-center text-xs font-bold cursor-pointer">
          D
        </div>
      </div>
    </div>
  );
}
