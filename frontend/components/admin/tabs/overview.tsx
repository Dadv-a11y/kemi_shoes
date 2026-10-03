"use client";

import { useState } from "react";

interface Order {
  id: string;
  client: string;
  status: "pending" | "progress" | "done" | "cancel";
  total: string;
}

interface Product {
  name: string;
  sales: number;
  percentage: number;
}

interface Alert {
  id: string;
  message: string;
}

const topProducts: Product[] = [
  { name: "Multicolore B&W", sales: 42, percentage: 92 },
  { name: "Jani.", sales: 36, percentage: 78 },
  { name: "GABI.", sales: 28, percentage: 60 },
  { name: "Spartiate", sales: 21, percentage: 45 },
  { name: "Karibu.", sales: 16, percentage: 34 },
];

const recentOrders: Order[] = [
  { id: "#KS-10234", client: "Daril M.", status: "progress", total: "28 000f" },
  { id: "#KS-10233", client: "Aïcha B.", status: "done", total: "12 000f" },
  { id: "#KS-10232", client: "Junior K.", status: "cancel", total: "15 000f" },
  { id: "#KS-10231", client: "Steve N.", status: "pending", total: "32 000f" },
];

const alerts: Alert[] = [
  { id: "1", message: 'Taille 42 en rupture — « Multicolore B&W »' },
  { id: "2", message: 'Taille 43 en rupture — « GABI. »' },
  { id: "3", message: '2 demandes de personnalisation en attente' },
];

const statusConfig = {
  pending: { label: "En attente", bg: "#eee", text: "#666" },
  progress: { label: "En livraison", bg: "#f6efdf", text: "#a6741f" },
  done: { label: "Livrée", bg: "#e8f0ea", text: "#3f6b4a" },
  cancel: { label: "Annulée", bg: "#f6e6e3", text: "#a13b2f" },
};

export function OverviewTab() {
  return (
    <div className="p-6 lg:p-7">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading text-xl lg:text-2xl font-semibold">
            Vue d'ensemble
          </h1>
          <p className="text-xs lg:text-sm text-muted mt-0.5">
            Aperçu de l'activité de la boutique
          </p>
        </div>
        <select className="border border-border rounded-[6px] px-3 py-1.5 text-xs lg:text-sm bg-white">
          <option>30 derniers jours</option>
          <option>7 derniers jours</option>
          <option>Dernier mois</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: "Commandes", value: "128", delta: "▲ +12% vs période précédente", positive: true },
          { label: "Ventes (unités)", value: "164", delta: "▲ +8%", positive: true },
          { label: "Chiffre d'affaires", value: "2,34M", delta: "▼ −3%", positive: false },
          { label: "Panier moyen", value: "18 300f", delta: "▲ +5%", positive: true },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-border rounded-[10px] p-4">
            <div className="text-[10.5px] uppercase tracking-[0.05em] text-muted mb-2">
              {kpi.label}
            </div>
            <div className="font-heading text-2xl lg:text-3xl font-semibold mb-1.5">
              {kpi.value}
            </div>
            <div
              className="text-xs font-semibold"
              style={{ color: kpi.positive ? "#3f6b4a" : "#a13b2f" }}
            >
              {kpi.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Top Products */}
      <div className="bg-white border border-border rounded-[10px] mb-5">
        <div className="flex justify-between items-center p-4 lg:p-4.5 border-b border-border">
          <h3 className="text-sm font-medium">Top 10 produits</h3>
          <a href="#" className="text-xs font-bold text-terracotta">
            Voir tout →
          </a>
        </div>
        <div className="p-4.5 lg:p-5">
          {topProducts.map((product, i) => (
            <div key={i} className="flex items-center gap-3 mb-3.5 last:mb-0">
              <div
                className="w-8.5 h-8.5 rounded-[6px] flex-shrink-0"
                style={{
                  background: "linear-gradient(150deg,#3a2c22,#171310)",
                }}
              />
              <div className="w-[150px] text-xs font-semibold flex-shrink-0">
                {product.name}
              </div>
              <div className="flex-1 bg-bone-dim h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-terracotta h-full rounded-full transition-all"
                  style={{ width: `${product.percentage}%` }}
                />
              </div>
              <div className="text-xs font-bold w-20 text-right flex-shrink-0">
                {product.sales} ventes
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Orders */}
        <div className="bg-white border border-border rounded-[10px]">
          <div className="flex justify-between items-center p-4 lg:p-4.5 border-b border-border">
            <h3 className="text-sm font-medium">Commandes récentes</h3>
            <a href="#" className="text-xs font-bold text-terracotta">
              Voir tout →
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-bone-dim">
                  <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]">
                    Commande
                  </th>
                  <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]">
                    Client
                  </th>
                  <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]">
                    Statut
                  </th>
                  <th className="text-left px-3.5 py-2.5 font-bold uppercase tracking-[0.05em] text-muted text-[10px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const status = statusConfig[order.status];
                  return (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="px-3.5 py-3 text-ink font-semibold">{order.id}</td>
                      <td className="px-3.5 py-3 text-ink">{order.client}</td>
                      <td className="px-3.5 py-3">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: status.bg, color: status.text }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-ink">{order.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white border border-border rounded-[10px]">
          <div className="p-4 lg:p-4.5 border-b border-border">
            <h3 className="text-sm font-medium">Alertes</h3>
          </div>
          <div className="p-4.5 lg:p-5">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex gap-2 text-xs py-2.5 border-b border-border last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0 mt-1.5" />
                <div>{alert.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
