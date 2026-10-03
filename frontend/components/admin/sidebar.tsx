"use client";

interface SidebarProps {
  tabs: Array<{ id: string; label: string; icon: string }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
}

export function Sidebar({ tabs, activeTab, onTabChange, isOpen }: SidebarProps) {
  const navItems = tabs.slice(0, 4);
  const configItems = tabs.slice(4);

  return (
    <>
      {/* Backdrop mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-void/50 z-40 lg:hidden"
          onClick={() => onTabChange(activeTab)}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`fixed left-0 top-0 bottom-0 w-[220px] bg-void text-bone flex flex-col z-50 transition-transform lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="border-b border-white/12 px-5 py-5">
          <div className="font-heading font-semibold text-sm">
            KEMI<span className="text-terracotta">·</span>SHOES
          </div>
          <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-bone/45 mt-1">
            Admin
          </div>
        </div>

        {/* Main navigation */}
        <div className="px-2.5 py-3.5">
          {navItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] font-medium rounded transition-all mb-0.5 ${
                activeTab === tab.id
                  ? "bg-terracotta text-white font-bold"
                  : "text-bone/72 hover:bg-white/6 hover:text-bone"
              }`}
            >
              <span className="w-4 text-center text-xs">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Configuration section */}
        <div className="px-2.5 pt-3.5 pb-1">
          <div className="text-[9.5px] uppercase tracking-[0.08em] text-bone/40 px-2.5 py-2 pb-1.5">
            Configuration
          </div>
          {configItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] font-medium rounded transition-all mb-0.5 ${
                activeTab === tab.id
                  ? "bg-terracotta text-white font-bold"
                  : "text-bone/72 hover:bg-white/6 hover:text-bone"
              }`}
            >
              <span className="w-4 text-center text-xs">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-white/10 px-5 py-3.5 text-[10.5px] text-bone/40">
          KEMI SHOES © 2026<br />
          Nexa Digital Lab
        </div>
      </nav>
    </>
  );
}
