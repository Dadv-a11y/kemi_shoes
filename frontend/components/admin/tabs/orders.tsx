"use client";

interface Order {
  id: string;
  client: string;
  date: string;
  zone: string;
  status: "pending" | "progress" | "done" | "cancel";
  total: string;
}

const orders: Order[] = [
  { id: "#KS-10234", client: "Daril M.", date: "16 août", zone: "Douala", status: "progress", total: "28 000f" },
  { id: "#KS-10233", client: "Aïcha B.", date: "16 août", zone: "Yaoundé", status: "done", total: "12 000f" },
  { id: "#KS-10232", client: "Junior K.", date: "15 août", zone: "Douala", status: "cancel", total: "15 000f" },
  { id: "#KS-10231", client: "Steve N.", date: "15 août", zone: "International", status: "pending", total: "32 000f" },
  { id: "#KS-10230", client: "Rosine T.", date: "14 août", zone: "Douala", status: "done", total: "18 000f" },
];

const statusConfig = {
  pending: { label: "En attente", bg: "#eee", text: "#666" },
  progress: { label: "En livraison", bg: "#f6efdf", text: "#a6741f" },
  done: { label: "Livrée", bg: "#e8f0ea", text: "#3f6b4a" },
  cancel: { label: "Annulée", bg: "#f6e6e3", text: "#a13b2f" },
};

export function OrdersTab() {
  return (
    <div className="p-6 lg:p-7">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-heading text-xl lg:text-2xl font-semibold mb-1">
          Commandes
        </h1>
        <p className="text-xs lg:text-sm text-muted">
          128 commandes sur la période
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center mb-5">
        {[
          { label: "Toutes (128)", active: true },
          { label: "En attente (6)", active: false },
          { label: "Confirmées (14)", active: false },
          { label: "Expédiées (22)", active: false },
          { label: "Livrées (78)", active: false },
          { label: "Annulées (8)", active: false },
        ].map((filter, i) => (
          <button
            key={i}
            className={`px-3 py-1.5 text-xs rounded-[6px] font-semibold transition-all ${
              filter.active
                ? "bg-ink text-white border border-ink"
                : "bg-white text-ink border border-border"
            }`}
          >
            {filter.label}
          </button>
        ))}
        <select className="ml-auto border border-border rounded-[6px] px-3 py-1.5 text-xs bg-white">
          <option>Zone : Toutes</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-border rounded-[10px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-bone-dim">
                <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]">Commande</th>
                <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]">Client</th>
                <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]">Date</th>
                <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]">Zone</th>
                <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]">Statut</th>
                <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]">Total</th>
                <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const status = statusConfig[order.status];
                return (
                  <tr key={order.id} className="border-b border-border last:border-0 hover:bg-bone/40">
                    <td className="px-3.5 py-3 font-semibold text-ink">{order.id}</td>
                    <td className="px-3.5 py-3 text-ink">{order.client}</td>
                    <td className="px-3.5 py-3 text-ink">{order.date}</td>
                    <td className="px-3.5 py-3 text-ink">{order.zone}</td>
                    <td className="px-3.5 py-3">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: status.bg, color: status.text }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-ink">{order.total}</td>
                    <td className="px-3.5 py-3 text-terracotta text-[11px] font-bold">
                      <a href="#" className="hover:underline">Voir →</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
