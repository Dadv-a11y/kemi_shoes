"use client";

import { useState } from "react";

interface Zone {
  id: string;
  name: string;
  country: string;
  fees: string;
  delay: string;
  cod: boolean;
  methods: string[];
  active: boolean;
}

const zones: Zone[] = [
  {
    id: "1",
    name: "Douala / Yaoundé",
    country: "Cameroun",
    fees: "1 500f",
    delay: "24–48h",
    cod: true,
    methods: ["Mobile Money", "Carte", "COD"],
    active: true,
  },
  {
    id: "2",
    name: "Autres régions",
    country: "Cameroun",
    fees: "2 500f",
    delay: "3–5 jours",
    cod: true,
    methods: ["Mobile Money", "Carte", "COD"],
    active: true,
  },
  {
    id: "3",
    name: "International",
    country: "Tous pays",
    fees: "Sur devis",
    delay: "7–14 jours",
    cod: false,
    methods: ["Carte"],
    active: true,
  },
];

export function DeliveryTab() {
  const [activeZones, setActiveZones] = useState<{ [key: string]: boolean }>(
    zones.reduce((acc, z) => ({ ...acc, [z.id]: z.active }), {})
  );

  const toggleZone = (id: string) => {
    setActiveZones((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-6 lg:p-7">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading text-xl lg:text-2xl font-semibold">
            Zones de livraison
          </h1>
          <p className="text-xs lg:text-sm text-muted mt-0.5">
            Pilote les frais, délais et moyens de paiement affichés au checkout
          </p>
        </div>
        <button className="bg-terracotta text-white px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-terracotta-deep transition">
          + Ajouter une zone
        </button>
      </div>

      {/* Zones Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-bone-dim text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Zone</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Frais</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Délai</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Paiement à la livraison</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Moyens de paiement</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {zones.map((zone) => (
              <tr key={zone.id} className="hover:bg-bone-dim/50 transition">
                <td className="px-4 py-3">
                  <div className="font-bold">{zone.name}</div>
                  <div className="text-muted text-[9px] mt-1">{zone.country}</div>
                </td>
                <td className="px-4 py-3">{zone.fees}</td>
                <td className="px-4 py-3">{zone.delay}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-[9px] font-bold ${
                      zone.cod
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {zone.cod ? "Oui" : "Non"}
                  </span>
                </td>
                <td className="px-4 py-3 flex flex-wrap gap-1">
                  {zone.methods.map((method) => (
                    <span
                      key={method}
                      className="inline-block px-2 py-0.5 rounded text-[8px] font-bold bg-bone-dim text-ink"
                    >
                      {method}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleZone(zone.id)}
                    className={`w-8 h-4.5 rounded-full transition ${
                      activeZones[zone.id] ? "bg-terracotta" : "bg-border"
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
