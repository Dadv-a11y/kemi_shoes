"use client";

interface Customer {
  id: string;
  name: string;
  phone: string;
  method: string;
  orders: number;
  lastOrder: string;
}

const customers: Customer[] = [
  { id: "1", name: "Daril M.", phone: "+237 6XX XXX XXX", method: "Google", orders: 4, lastOrder: "16 août" },
  { id: "2", name: "Aïcha B.", phone: "+237 6XX XXX XXX", method: "Téléphone", orders: 2, lastOrder: "16 août" },
  { id: "3", name: "Junior K.", phone: "+237 6XX XXX XXX", method: "Facebook", orders: 1, lastOrder: "15 août" },
  { id: "4", name: "Rosine T.", phone: "+237 6XX XXX XXX", method: "Téléphone", orders: 6, lastOrder: "14 août" },
];

export function CustomersTab() {
  return (
    <div className="p-6 lg:p-7">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading text-xl lg:text-2xl font-semibold">
            Clients
          </h1>
          <p className="text-xs lg:text-sm text-muted mt-0.5">
            312 comptes créés
          </p>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-bone-dim text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Client</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Téléphone</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Connexion</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Commandes</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Dernière commande</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-bone-dim/50 transition">
                <td className="px-4 py-3 font-bold">{customer.name}</td>
                <td className="px-4 py-3">{customer.phone}</td>
                <td className="px-4 py-3">{customer.method}</td>
                <td className="px-4 py-3">{customer.orders}</td>
                <td className="px-4 py-3">{customer.lastOrder}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
