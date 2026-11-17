import { useEffect, useState } from "react";
import { orderService } from "@/core/services/order/order.service";
import type { OrderResponse } from "@/core/types/order/order.model";

export default function AssignedDeliveries() {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await orderService.getAssignedDeliveries();
      setOrders(response.data ?? []);
    } catch {
      setError("No se pudieron consultar los repartos asignados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function update(id: number, nextStatus: "OUT_FOR_DELIVERY" | "DELIVERED") {
    setBusyId(id);
    setError("");
    try {
      await orderService.updateAssignedDeliveryStatus(id, nextStatus);
      await refresh();
    } catch {
      setError("No se pudo actualizar el estado del pedido. Verifica la asignación.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="min-h-screen bg-neutral-950 px-4 py-28 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Mis repartos asignados</h1>
            <p className="text-neutral-400 mt-2">Pedidos vinculados a tu cuenta de empleado.</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading}
            className="rounded bg-red-600 px-4 py-2 disabled:opacity-50">
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>
        {error && <p role="alert" className="mb-5 rounded bg-red-950 p-3 text-red-200">{error}</p>}
        {!loading && orders.length === 0 && <p className="text-neutral-400">No tienes repartos asignados.</p>}
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="font-semibold">Pedido #{order.id}</h2>
                <span className="text-sm text-neutral-300">{order.statusName || order.statusCode}</span>
              </div>
              <p className="mt-3 text-sm text-neutral-300">{order.deliveryStreet || "Sin dirección"}</p>
              {order.deliveryReference && <p className="text-xs text-neutral-400">Referencia: {order.deliveryReference}</p>}
              {order.estimatedDuration && <p className="mt-2 text-sm text-neutral-400">Tiempo de viaje: {order.estimatedDuration}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                {order.deliveryLatitude != null && order.deliveryLongitude != null && (
                  <a target="_blank" rel="noopener noreferrer" className="rounded border border-neutral-500 px-4 py-2 text-sm"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      `${order.deliveryLatitude},${order.deliveryLongitude}`
                    )}`}>Ver ruta</a>
                )}
                {order.statusCode === "READY_FOR_PICKUP" && (
                  <button disabled={busyId === order.id} type="button"
                    onClick={() => void update(order.id, "OUT_FOR_DELIVERY")}
                    className="rounded bg-red-600 px-4 py-2 text-sm disabled:opacity-50">Iniciar reparto</button>
                )}
                {order.statusCode === "OUT_FOR_DELIVERY" && (
                  <button disabled={busyId === order.id} type="button"
                    onClick={() => void update(order.id, "DELIVERED")}
                    className="rounded bg-green-700 px-4 py-2 text-sm disabled:opacity-50">Marcar entregado</button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
