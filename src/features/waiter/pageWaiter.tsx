import { logoutFromServer } from "@/core/services/auth/logout";
import { orderService } from "@/core/services/order/order.service";
import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";
import type { OrderResponse } from "@/core/types/order/order.model";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Truck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type Section = "dashboard" | "orders" | "tables";
type RestaurantTable = {
  id: number;
  code: string;
  alias?: string | null;
  capacity: number;
  status: string;
  activeOrderId?: number | null;
};

const sections: { id: Section; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Resumen", Icon: LayoutDashboard },
  { id: "orders", label: "Pedidos", Icon: ClipboardList },
  { id: "tables", label: "Mesas", Icon: Users },
];

const completedStatuses = new Set(["COMPLETED", "DELIVERED", "CANCELLED", "FAILED"]);
const money = (amount: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

function orderStatusLabel(order: OrderResponse) {
  return order.statusName || order.statusCode.replaceAll("_", " ");
}

function orderTypeLabel(order: OrderResponse) {
  if (order.tableId != null) return "En mesa";
  if (order.deliveryStreet) return "Delivery";
  if (order.pickupStoreId) return "Para llevar";
  return order.typeName || "Pedido";
}

function TableStatus({ status }: { status: string }) {
  const label =
    status === "FREE" ? "Libre" :
    status === "OCCUPIED" ? "Ocupada" :
    status === "RESERVED" ? "Reservada" : status;
  const color =
    status === "FREE" ? "text-emerald-300 bg-emerald-500/10" :
    status === "OCCUPIED" ? "text-amber-300 bg-amber-500/10" :
    "text-blue-300 bg-blue-500/10";
  return <span className={"rounded-full px-3 py-1 text-xs font-semibold " + color}>{label}</span>;
}

function Status({ order }: { order: OrderResponse }) {
  const color = completedStatuses.has(order.statusCode)
    ? "bg-zinc-700/60 text-zinc-300"
    : order.statusCode === "OUT_FOR_DELIVERY"
      ? "bg-blue-500/15 text-blue-300"
      : "bg-amber-500/15 text-amber-300";
  return <span className={"rounded-full px-3 py-1 text-xs font-semibold " + color}>{orderStatusLabel(order)}</span>;
}

function OrderCard({ order }: { order: OrderResponse }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#202024] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-bold text-white">Pedido #{order.id}</div>
          <div className="mt-1 text-xs text-zinc-400">
            {orderTypeLabel(order)} · {order.customerName || "Cliente sin nombre"}
            {order.tableCode && " · Mesa " + order.tableCode}
          </div>
        </div>
        <Status order={order} />
      </div>
      {order.details?.length ? (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          {order.details.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <span className="text-zinc-200">{item.quantity} × {item.productName}</span>
                {item.notes && <p className="text-xs text-zinc-400">{item.notes}</p>}
              </div>
              <span className="shrink-0 text-zinc-300">{money(item.quantity * item.unitPrice)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
        <span className="text-zinc-400">
          Pago: {order.paymentStatus === "CONFIRMED" ? "Confirmado" :
            order.paymentStatus === "PENDING" ? "Pendiente" :
            order.paymentStatus || "Sin información"}
        </span>
        <strong className="text-white">{money(order.total || 0)}</strong>
      </div>
    </article>
  );
}

export default function WaiterApp() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [section, setSection] = useState<Section>("dashboard");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loggingOut, setLoggingOut] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ["waiter", "orders"],
    queryFn: async () => {
      const response = await orderService.getAllOrders("es");
      if (!response.success) throw new Error(response.message);
      return response.data ?? [];
    },
    refetchInterval: 15000,
  });

  const tablesQuery = useQuery({
    queryKey: ["waiter", "tables"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<RestaurantTable[]>>("/tables");
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data ?? [];
    },
    refetchInterval: 15000,
  });

  const orders = ordersQuery.data ?? [];
  const tables = tablesQuery.data ?? [];
  const active = orders.filter((o) => !completedStatuses.has(o.statusCode));
  const dineIn = active.filter((o) => o.tableId != null);
  const pending = active.filter((o) => ["PENDING", "PENDING_CONFIRMATION"].includes(o.statusCode));

  const statuses = useMemo(() => {
    const values = new Set(orders.map((o) => o.statusCode));
    return Array.from(values).sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return orders.filter((o) =>
      (statusFilter === "ALL" || o.statusCode === statusFilter) &&
      (!term ||
        String(o.id).includes(term) ||
        (o.customerName || "").toLocaleLowerCase("es").includes(term) ||
        (o.tableCode || "").toLocaleLowerCase("es").includes(term))
    );
  }, [orders, search, statusFilter]);

  const reload = () => {
    void ordersQuery.refetch();
    void tablesQuery.refetch();
  };

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutFromServer();
    } finally {
      setLoggingOut(false);
      navigate("/auth/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#141417] text-zinc-100">
      <header className="border-b border-white/10 bg-[#1c1c20]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Restaurant Central</p>
            <h1 className="mt-1 text-2xl font-extrabold">Panel de atención</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {user?.fullName?.trim() || user?.username || "Personal del restaurante"} · Mozo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={reload} disabled={ordersQuery.isFetching || tablesQuery.isFetching}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50">
              <RefreshCw size={16} /> Actualizar
            </button>
            <button type="button" onClick={() => void onLogout()} disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50">
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7">
        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Secciones del personal">
          {sections.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setSection(id)}
              aria-current={section === id ? "page" : undefined}
              className={section === id
                ? "inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white"
                : "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#242428] px-4 py-3 text-sm text-zinc-300 hover:bg-white/10"}>
              <Icon size={17} /> {label}
            </button>
          ))}
          <Link to="/driver" className="inline-flex items-center gap-2 rounded-xl border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-600/20">
            <Truck size={17} /> Mis repartos
          </Link>
          <Link to="/" className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft size={16} /> Volver al inicio
          </Link>
        </nav>

        {(ordersQuery.isError || tablesQuery.isError) && (
          <div role="alert" className="mb-6 rounded-xl border border-red-700/50 bg-red-950/40 p-4 text-sm text-red-200">
            {ordersQuery.isError && <p>No se pudieron consultar los pedidos. Comprueba la conexión con el backend.</p>}
            {tablesQuery.isError && <p>No se pudieron consultar las mesas. Comprueba la conexión con el backend.</p>}
          </div>
        )}

        {section === "dashboard" && (
          <section aria-label="Resumen de atención">
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Pedidos activos", value: ordersQuery.isPending ? "—" : active.length },
                { label: "Pendientes", value: ordersQuery.isPending ? "—" : pending.length },
                { label: "Pedidos en mesa", value: ordersQuery.isPending ? "—" : dineIn.length },
                { label: "Mesas libres", value: tablesQuery.isPending ? "—" : tables.filter((t) => t.status === "FREE").length },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-[#242428] p-5">
                  <div className="text-xs text-zinc-400">{metric.label}</div>
                  <div className="mt-2 text-3xl font-extrabold text-white">{metric.value}</div>
                </div>
              ))}
            </div>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Pedidos recientes</h2>
              <button type="button" className="text-sm font-semibold text-red-300 hover:text-red-200" onClick={() => setSection("orders")}>
                Ver todos
              </button>
            </div>
            {ordersQuery.isPending ? <p className="text-zinc-400">Cargando pedidos...</p> :
              orders.length === 0 ? <p className="rounded-xl border border-white/10 p-5 text-zinc-400">No hay pedidos registrados.</p> :
                <div className="grid gap-4 md:grid-cols-2">
                  {[...orders].sort((a, b) => b.id - a.id).slice(0, 6).map((order) => <OrderCard key={order.id} order={order} />)}
                </div>}
          </section>
        )}

        {section === "orders" && (
          <section aria-label="Listado de pedidos">
            <h2 className="mb-5 text-xl font-bold">Pedidos del restaurante</h2>
            <div className="mb-5 flex flex-wrap gap-3">
              <label className="flex min-w-[210px] flex-1 items-center gap-2 rounded-xl border border-white/15 bg-[#242428] px-3">
                <Search size={17} className="shrink-0 text-zinc-400" />
                <span className="sr-only">Buscar pedido</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar pedido, cliente o mesa" className="w-full bg-transparent py-3 text-sm text-white outline-none" />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#242428] px-3 text-sm">
                <span className="sr-only">Filtrar por estado</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="max-w-[210px] bg-transparent py-3 text-zinc-200 outline-none">
                  <option value="ALL" className="bg-zinc-900">Todos los estados</option>
                  {statuses.map((status) => <option key={status} value={status} className="bg-zinc-900">{status.replaceAll("_", " ")}</option>)}
                </select>
              </label>
            </div>
            {ordersQuery.isPending ? <p className="text-zinc-400">Cargando pedidos...</p> :
              filteredOrders.length === 0 ? <p className="rounded-xl border border-white/10 p-5 text-zinc-400">No se encontraron pedidos para estos filtros.</p> :
                <div className="grid gap-4 md:grid-cols-2">
                  {[...filteredOrders].sort((a, b) => b.id - a.id).map((order) => <OrderCard key={order.id} order={order} />)}
                </div>}
            <p className="mt-5 text-xs text-zinc-500">La información proviene de los pedidos registrados en el sistema y se actualiza automáticamente cada 15 segundos.</p>
          </section>
        )}

        {section === "tables" && (
          <section aria-label="Mesas">
            <h2 className="mb-5 text-xl font-bold">Mesas del restaurante</h2>
            {tablesQuery.isPending ? <p className="text-zinc-400">Cargando mesas...</p> :
              tables.length === 0 ? <p className="rounded-xl border border-white/10 p-5 text-zinc-400">No hay mesas configuradas.</p> :
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tables.map((table) => (
                    <article key={table.id} className="rounded-2xl border border-white/10 bg-[#242428] p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-lg font-bold">Mesa {table.alias || table.code || table.id}</div>
                        <TableStatus status={table.status} />
                      </div>
                      <div className="mt-4 text-sm text-zinc-400">Capacidad: {table.capacity} personas</div>
                      {table.activeOrderId != null && <p className="mt-2 text-sm text-zinc-300">Pedido activo #{table.activeOrderId}</p>}
                    </article>
                  ))}
                </div>}
            <p className="mt-5 text-xs text-zinc-500">Vista de consulta. Los cambios de disponibilidad deben realizarse mediante el flujo de pedidos o reservas, no con datos simulados.</p>
          </section>
        )}
      </div>
    </div>
  );
}
