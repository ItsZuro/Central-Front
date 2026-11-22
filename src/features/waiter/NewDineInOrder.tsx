import { api } from "@/core/api/api";
import { orderService } from "@/core/services/order/order.service";
import type { ApiResponse } from "@/core/types/base/api-response";
import type { OrderRequest } from "@/core/types/order/order.model";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

type Catalog = { id: number; code: string };
type Customer = { id: number; fullName: string; username: string; email: string };
type Product = { id: number; name: string; price: number; active: boolean };
type Table = { id: number; code: string; alias?: string | null; status: string; capacity: number };

type NewDineInOrderProps = {
  onCreated: () => void;
  defaultTableId?: number;
  label?: string;
  variant?: "primary" | "outline";
};

export default function NewDineInOrder({
  onCreated,
  defaultTableId,
  label = "Pedido en mesa",
  variant = "primary",
}: NewDineInOrderProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [tableId, setTableId] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const config = useQuery({
    queryKey: ["waiter", "pos-config"],
    enabled: open,
    queryFn: async () => {
      const [types, statuses, tables, products] = await Promise.all([
        api.get<ApiResponse<Catalog[]>>("/order-types"),
        api.get<ApiResponse<Catalog[]>>("/order-statuses"),
        api.get<ApiResponse<Table[]>>("/tables"),
        api.get<ApiResponse<Product[]>>("/products"),
      ]);
      if (![types.data.success, statuses.data.success, tables.data.success, products.data.success].every(Boolean)) {
        throw new Error("No se pudo cargar el catálogo de venta presencial.");
      }
      return {
        types: types.data.data,
        statuses: statuses.data.data,
        tables: tables.data.data,
        products: products.data.data.filter((item) => item.active),
      };
    },
    staleTime: 10000,
  });

  const customers = useQuery({
    queryKey: ["waiter", "customer-search", customerSearch.trim()],
    enabled: open && customerSearch.trim().length >= 2,
    queryFn: async () => {
      const response = await api.get<ApiResponse<Customer[]>>("/customers/search", {
        params: { query: customerSearch.trim() },
      });
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data ?? [];
    },
  });

  const createOrder = useMutation({
    mutationFn: (request: OrderRequest) => orderService.createPosSale(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["waiter"] });
      toast.success("Pedido presencial registrado correctamente.");
      setOpen(false);
      setCustomerId(null);
      setSelectedCustomer("");
      setCustomerSearch("");
      setTableId("");
      setQuantities({});
      onCreated();
    },
  });

  const dineInType = config.data?.types.find((t) => t.code === "DINE_IN");
  const initialStatus = config.data?.statuses.find((s) => s.code === "PENDING_CONFIRMATION") ||
    config.data?.statuses.find((s) => s.code === "PENDING");
  const selectedItems = config.data?.products.filter((p) => (quantities[p.id] || 0) > 0) ?? [];
  const canSubmit = Boolean(
    customerId && tableId && dineInType && initialStatus && selectedItems.length > 0 && !createOrder.isPending
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !customerId || !dineInType || !initialStatus) return;
    createOrder.mutate({
      customerId,
      tableId: Number(tableId),
      typeId: dineInType.id,
      statusId: initialStatus.id,
      details: selectedItems.map((item) => ({
        productId: item.id,
        quantity: quantities[item.id],
      })),
    });
  }

  return (
    <>
      <button type="button" onClick={() => { setTableId(defaultTableId != null ? String(defaultTableId) : ""); setOpen(true); void config.refetch(); }}
        className={variant === "primary"
          ? "inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-600"
          : "inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-white/10"}>
        <Plus size={17} /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="waiter-order-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#202024] p-6 text-white shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="waiter-order-title" className="text-xl font-bold">Nuevo pedido presencial</h2>
                <p className="mt-1 text-sm text-zinc-400">Selecciona un cliente registrado, una mesa libre y los platos.</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)}
                disabled={createOrder.isPending} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-50">
                <X size={20} />
              </button>
            </div>

            {config.isPending ? <p className="text-sm text-zinc-400">Cargando datos del restaurante...</p> :
              config.isError ? <p role="alert" className="text-sm text-red-300">No se pudo cargar el catálogo. Cierra y vuelve a intentar.</p> :
                <form onSubmit={submit} className="space-y-5">
                  <div>
                    <label htmlFor="waiter-customer" className="mb-2 block text-sm font-semibold">Cliente</label>
                    <input id="waiter-customer" value={customerSearch}
                      onChange={(event) => {
                        setCustomerSearch(event.target.value);
                        setCustomerId(null);
                        setSelectedCustomer("");
                      }}
                      placeholder="Buscar por nombre o correo" autoComplete="off"
                      className="w-full rounded-lg border border-white/20 bg-zinc-900 p-3 text-sm outline-none focus:border-red-500" />
                    {selectedCustomer && <p className="mt-2 text-xs text-emerald-300">Seleccionado: {selectedCustomer}</p>}
                    {!customerId && customerSearch.trim().length >= 2 && (
                      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/10">
                        {customers.isPending ? <p className="p-3 text-xs text-zinc-400">Buscando clientes...</p> :
                          customers.isError ? <p role="alert" className="p-3 text-xs text-red-300">No se pudo realizar la búsqueda.</p> :
                            (customers.data ?? []).length === 0 ? <p className="p-3 text-xs text-zinc-400">No se encontraron clientes.</p> :
                              customers.data?.map((customer) => (
                                <button key={customer.id} type="button"
                                  onClick={() => { setCustomerId(customer.id); setSelectedCustomer(customer.fullName || customer.username || customer.email); }}
                                  className="block w-full border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/10">
                                  {customer.fullName || customer.username} <span className="text-xs text-zinc-400">{customer.email}</span>
                                </button>
                              ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="waiter-table" className="mb-2 block text-sm font-semibold">Mesa disponible</label>
                    <select id="waiter-table" required value={tableId} onChange={(event) => setTableId(event.target.value)}
                      className="w-full rounded-lg border border-white/20 bg-zinc-900 p-3 text-sm">
                      <option value="">Selecciona una mesa</option>
                      {config.data?.tables.filter((table) => table.status === "FREE").map((table) => (
                        <option key={table.id} value={table.id}>
                          Mesa {table.alias || table.code || table.id} — {table.capacity} personas
                        </option>
                      ))}
                    </select>
                    {!config.data?.tables.some((table) => table.status === "FREE") &&
                      <p className="mt-2 text-xs text-amber-300">No hay mesas libres actualmente.</p>}
                  </div>

                  <fieldset>
                    <legend className="mb-3 text-sm font-semibold">Productos</legend>
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {config.data?.products.map((product) => (
                        <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                          <div>
                            <div className="text-sm text-zinc-100">{product.name}</div>
                            <div className="text-xs text-zinc-400">
                              {new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(product.price)}
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-zinc-400">
                            Cantidad
                            <input type="number" min={0} max={99} step={1} aria-label={"Cantidad de " + product.name}
                              value={quantities[product.id] || 0}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setQuantities((previous) => ({ ...previous,
                                  [product.id]: Number.isFinite(value) ? Math.max(0, Math.min(99, Math.floor(value))) : 0,
                                }));
                              }}
                              className="w-16 rounded-md border border-white/20 bg-zinc-900 p-2 text-center text-white" />
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  {createOrder.isError &&
                    <p role="alert" className="rounded-lg border border-red-600/40 bg-red-950/40 p-3 text-sm text-red-200">
                      No se pudo registrar el pedido. Verifica el cliente, la mesa y la disponibilidad de los productos.
                    </p>}
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setOpen(false)} disabled={createOrder.isPending}
                      className="rounded-lg border border-white/20 px-4 py-3 text-sm disabled:opacity-50">Cancelar</button>
                    <button type="submit" disabled={!canSubmit}
                      className="rounded-lg bg-red-700 px-5 py-3 text-sm font-bold disabled:opacity-40">
                      {createOrder.isPending ? "Registrando..." : "Registrar pedido"}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400">El cobro se realiza por caja. Registrar el pedido no confirma un pago.</p>
                </form>}
          </div>
        </div>
      )}
    </>
  );
}
