"use client";

import { useState } from "react";

interface Product {
  id: string;
  image: string;
  name: string;
  category: string;
  price: string;
  status: "active" | "draft";
}

const products: Product[] = [
  { id: "1", image: "", name: "Multicolore Black and White", category: "Homme", price: "6 500f", status: "active" },
  { id: "2", image: "", name: "Jani.", category: "Femme", price: "6 500–8 000f", status: "active" },
  { id: "3", image: "", name: "GABI.", category: "Femme", price: "12 000f", status: "active" },
  { id: "4", image: "", name: "Spartiate", category: "Homme", price: "18 000f", status: "draft" },
];

export function ProductsTab() {
  const [showNew, setShowNew] = useState(false);
  const [productName, setProductName] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [price, setPrice] = useState("6 500 FCFA");

  return (
    <div className="p-6 lg:p-7">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading text-xl lg:text-2xl font-semibold">
            Produits
          </h1>
          <p className="text-xs lg:text-sm text-muted mt-0.5">
            42 produits au catalogue
          </p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="bg-terracotta text-white px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-terracotta-deep transition"
        >
          + Nouveau produit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setShowNew(false)}
          className={`px-3 py-2 text-xs font-bold rounded-md ${
            !showNew
              ? "bg-ink text-bone"
              : "border border-border bg-white text-ink hover:bg-bone-dim"
          }`}
        >
          Catalogue
        </button>
        <button
          onClick={() => setShowNew(true)}
          className={`px-3 py-2 text-xs font-bold rounded-md ${
            showNew
              ? "bg-ink text-bone"
              : "border border-border bg-white text-ink hover:bg-bone-dim"
          }`}
        >
          Nouveau produit
        </button>
      </div>

      {!showNew ? (
        /* Products List */
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-bone-dim text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider"></th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Produit</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Catégorie</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Prix</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-bone-dim/50 transition">
                  <td className="px-4 py-3">
                    <div className="w-9 h-9 rounded bg-gradient-to-br from-gray-700 to-black"></div>
                  </td>
                  <td className="px-4 py-3 font-bold">{product.name}</td>
                  <td className="px-4 py-3">{product.category}</td>
                  <td className="px-4 py-3">{product.price}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold ${
                        product.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {product.status === "active" ? "Actif" : "Brouillon"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-terracotta text-xs font-bold hover:underline">
                      Éditer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* New Product Form */
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Photos */}
            <div className="bg-white border border-border rounded-xl p-5">
              <h3 className="font-bold mb-4">Informations produit</h3>
              
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                  Photos
                </label>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-muted text-xs mb-3">
                  ⬆ Glissez des photos ici ou cliquez pour importer
                </div>
                <div className="flex gap-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-black rounded"></div>
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-black rounded"></div>
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-black rounded"></div>
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-black rounded"></div>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                  Nom du produit
                </label>
                <input
                  type="text"
                  placeholder="Ex. Multicolore Black and White"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:border-terracotta"
                />
              </div>

              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                  Description (FR)
                </label>
                <textarea
                  rows={3}
                  placeholder="Cuir pleine fleur tressé, semelle cuir cousue main…"
                  className="w-full border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:border-terracotta"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                    Catégorie
                  </label>
                  <select className="w-full border border-border rounded-md px-3 py-2 text-xs bg-white">
                    <option>Homme</option>
                    <option>Femme</option>
                    <option>Nouveautés</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                    Statut
                  </label>
                  <div className="flex gap-2">
                    {["Actif", "Brouillon", "Rupture"].map((status) => (
                      <button
                        key={status}
                        onClick={() => setSelectedStatus(status.toLowerCase())}
                        className={`px-3 py-1.5 text-xs font-bold rounded ${
                          (status === "Actif" && selectedStatus === "actif") ||
                          (status === "Brouillon" && selectedStatus === "brouillon")
                            ? "bg-ink text-white"
                            : "border border-border bg-white"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                    Prix
                  </label>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                    Prix barré (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="—"
                    className="w-full border border-border rounded-md px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="font-bold mb-4">Aperçu en temps réel</h3>
            <div className="border border-border rounded-lg p-4 text-center text-xs text-muted mb-4">
              <div className="w-full h-40 bg-gradient-to-br from-gray-700 to-black rounded mb-3"></div>
              <div className="font-semibold">{productName || "Multicolore Black and White"}</div>
              <div className="text-muted text-xs mt-1">6 500 FCFA</div>
            </div>
          </div>

          {/* Actions */}
          <div className="lg:col-span-2 flex gap-3">
            <button className="flex-1 border border-border px-4 py-2.5 rounded-md text-xs font-bold hover:bg-bone-dim transition">
              Enregistrer le brouillon
            </button>
            <button className="flex-1 bg-terracotta text-white px-4 py-2.5 rounded-md text-xs font-bold hover:bg-terracotta-deep transition">
              Publier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
