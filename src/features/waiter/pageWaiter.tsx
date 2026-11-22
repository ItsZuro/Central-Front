import { api } from "@/core/api/api";
import { logoutFromServer } from "@/core/services/auth/logout";
import { orderService } from "@/core/services/order/order.service";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";
import type { OrderResponse } from "@/core/types/order/order.model";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  Coffee,
  LayoutDashboard,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Truck,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NewDineInOrder from "./NewDineInOrder";

type Section = "dashboard" | "orders" | "tables" | "reservations";
type OrderScope = "room" | "other" | "all";
type ReservationScope = "active" | "all";

type RestaurantTable = {
  id: number;
  code: string;
  alias?: string | null;
  capacity: number;
  status: string;
  activeOrderId?: number | null;
};

type Reservation = {
  id: number;
  customerId: number;
  customerName: string;
  tableId: number;
  tableNumber: string;
  contactName: string;
  contactPhone: string;
  reservationDate: string;
  reservationTime: string;
  numberOfPeople: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
};

type Paged<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  pageNumber: number;
};

const tabs: { id: Section; label: string; Icon: LucideIcon }[] = [
  { id: "dashboard", label: "Resumen", Icon: LayoutDashboard },
  { id: "orders", label: "Pedidos", Icon: ClipboardList },
  { id: "tables", label: "Mesas", Icon: Users },
  { id: "reservations", label: "Reservas", Icon: CalendarDays },
];

const terminal = new Set(["COMPLETED", "DELIVERED", "CANCELLED", "FAILED", "REFUNDED"]);
const activeReservation = (reservation: Reservation) =>
  reservation.status === "CONFIRMED" || reservation.status === "PENDING";

const currency = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

function localLimaParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)?.value || "00";
  return { date: part("year") + "-" + part("month") + "-" + part("day"), time: part("hour") + ":" + part("minute") };
}

function prettyDate(date: string) {
  const [year, month, day] = date.split("-");
  return [day, month, year].join("/");
}

function isRoomOrder(order: OrderResponse) {
  return order.tableId != null || /presencial|dine[\s_-]?in/i.test(order.typeName || "");
}

function statusLabel(code: string) {
  const labels: Record<string, string> = {
    PENDING_CONFIRMATION: "Por confirmar",
    PENDING: "Pendiente",
    CONFIRMED: "Confirmado",
    IN_PROGRESS: "En preparación",
    READY_FOR_PICKUP: "Listo para recoger",
    OUT_FOR_DELIVERY: "En camino",
    DELIVERED: "Entregado",
    COMPLETED: "Completado",
    CANCELLED: "Cancelado",
    FAILED: "Fallido",
    REFUNDED: "Reembolsado",
  };
  return labels[code] || code.replace(/_/g, " ");
}

function orderChannel(order: OrderResponse) {
  if (isRoomOrder(order)) return "Salón";
  if (order.deliveryStreet || /delivery|domicilio/i.test(order.typeName || "")) return "Delivery";
  if (order.pickupStoreId != null || /llevar|take.away/i.test(order.typeName || "")) return "Para llevar";
  return order.typeName || "Pedido";
}

function StatusPill({ status }: { status: string }) {
  const style =
    status === "FREE" || status === "CONFIRMED" || status === "DELIVERED"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : status === "IN_PROGRESS" || status === "OCCUPIED"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
        : status === "RESERVED" || status === "OUT_FOR_DELIVERY"
          ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
          : terminal.has(status)
            ? "border-zinc-600/50 bg-zinc-500/10 text-zinc-400"
            : "border-red-500/20 bg-red-500/10 text-red-300";
  const label =
    status === "FREE" ? "Libre" :
    status === "OCCUPIED" ? "Ocupada" :
    status === "RESERVED" ? "Reservada" : statusLabel(status);
  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold " + style}>
      {label}
    </span>
  );
}

function Empty({ icon: Icon, heading, detail }: { icon: LucideIcon; heading: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-6 py-12 text-center">
      <Icon size={26} className="mx-auto text-zinc-500" />
      <p className="mt-3 text-sm font-bold text-zinc-200">{heading}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-6 text-zinc-500">{detail}</p>
    </div>
  );
}

function OrderCard({ order, compact = false }: { order: OrderResponse; compact?: boolean }) {
  return (
    <article className="rounded-2xl border border-white/[0.09] bg-[#232327] p-4 transition-colors hover:border-white/20 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-white">Pedido #{order.id}</h3>
            <span className="rounded-md bg-white/[0.07] px-2 py-0.5 text-[11px] text-zinc-300">{orderChannel(order)}</span>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            {order.tableCode ? "Mesa " + order.tableCode + " · " : ""}
            {order.customerName || "Cliente sin nombre"}
          </p>
        </div>
        <StatusPill status={order.statusCode} />
      </div>
      {!compact && order.details?.length ? (
        <div className="mt-4 space-y-2 border-t border-white/[0.08] pt-4">
          {order.details.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
              <div className="min-w-0">
                <span className="text-zinc-200">{item.quantity} × {item.productName}</span>
                {item.notes && <p className="mt-0.5 text-xs text-zinc-500">{item.notes}</p>}
              </div>
              <span className="shrink-0 text-xs text-zinc-400">{currency.format(item.quantity * item.unitPrice)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-400">
          {order.details?.length || 0} {(order.details?.length || 0) === 1 ? "producto" : "productos"} en el pedido
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
        <span className="text-xs text-zinc-400">
          Pago: {order.paymentStatus === "CONFIRMED" ? "Confirmado" :
            order.paymentStatus === "PENDING" ? "Pendiente" :
              order.paymentStatus ? statusLabel(order.paymentStatus) : "Sin información"}
        </span>
        <strong className="text-sm text-white">{currency.format(order.total || 0)}</strong>
      </div>
    </article>
  );
}

function Kpi({
  label, value, hint, Icon, accent = "red",
}: { label: string; value: number | string; hint: string; Icon: LucideIcon; accent?: "red" | "amber" | "green" | "blue" }) {
  const colors: Record<string, string> = {
    red: "text-red-300 bg-red-500/10",
    amber: "text-amber-300 bg-amber-500/10",
    green: "text-emerald-300 bg-emerald-500/10",
    blue: "text-sky-300 bg-sky-500/10",
  };
  return (
    <div className="rounded-2xl border border-white/[0.09] bg-[#232327] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-zinc-400">{label}</p>
        <span className={"rounded-xl p-2.5 " + colors[accent]}><Icon size={19} /></span>
      </div>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

async function fetchReservations(date: string, page: number) {
  const response = await api.get<ApiResponse<Paged<Reservation>>>("/reservations/filter", {
    params: {
      startDate: date, endDate: date, page, size: 100, sort: "reservationTime,asc",
    },
  });
  if (!response.data.success) throw new Error(response.data.message || "No se pudieron cargar las reservas.");
  return response.data.data;
}

export default function WaiterApp() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const today = localLimaParts().date;
  const [section, setSection] = useState<Section>("dashboard");
  const [orderScope, setOrderScope] = useState<OrderScope>("room");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState(today);
  const [reservationPage, setReservationPage] = useState(0);
  const [reservationScope, setReservationScope] = useState<ReservationScope>("active");
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

  const todayReservations = useQuery({
    queryKey: ["waiter", "reservations", today, 0],
    queryFn: () => fetchReservations(today, 0),
    refetchInterval: 60000,
  });
  const dailyReservations = useQuery({
    queryKey: ["waiter", "reservations", selectedDate, reservationPage],
    queryFn: () => fetchReservations(selectedDate, reservationPage),
    refetchInterval: 60000,
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const tables = useMemo(() => tablesQuery.data ?? [], [tablesQuery.data]);
  const allRoomOrders = useMemo(() => orders.filter(isRoomOrder), [orders]);
  const openRoomOrders = useMemo(
    () => allRoomOrders.filter((order) => !terminal.has(order.statusCode)), [allRoomOrders]
  );
  const occupiedTables = tables.filter((table) => table.status === "OCCUPIED");
  const freeTables = tables.filter((table) => table.status === "FREE");
  const reservationsToday = todayReservations.data?.content ?? [];
  const activeReservationsToday = reservationsToday.filter(activeReservation);
  const upcomingReservations = activeReservationsToday
    .filter((reservation) => reservation.reservationTime.slice(0, 5) >= localLimaParts().time)
    .sort((a, b) => a.reservationTime.localeCompare(b.reservationTime));

  const roomStatuses = useMemo(
    () => Array.from(new Set(orders.map((order) => order.statusCode))).sort(), [orders]
  );
  const filteredOrders = useMemo(() => {
    const search = orderSearch.trim().toLocaleLowerCase("es");
    return orders.filter((order) =>
      (orderScope === "all" || (orderScope === "room" ? isRoomOrder(order) : !isRoomOrder(order))) &&
      (orderStatus === "ALL" || orderStatus === order.statusCode) &&
      (!search || String(order.id).includes(search) ||
        (order.customerName || "").toLocaleLowerCase("es").includes(search) ||
        (order.tableCode || "").toLocaleLowerCase("es").includes(search))
    ).sort((a, b) => b.id - a.id);
  }, [orders, orderSearch, orderScope, orderStatus]);

  const displayedReservations = (dailyReservations.data?.content ?? [])
    .filter((reservation) => reservationScope === "all" || activeReservation(reservation))
    .sort((a, b) => a.reservationTime.localeCompare(b.reservationTime));

  const reload = () => {
    void ordersQuery.refetch();
    void tablesQuery.refetch();
    void todayReservations.refetch();
    void dailyReservations.refetch();
  };

  const changeSection = (next: Section) => setSection(next);
  const viewOrder = (id: number) => {
    setOrderScope("room");
    setOrderSearch(String(id));
    setOrderStatus("ALL");
    setSection("orders");
  };
  const onCreated = () => {
    reload();
    setOrderSearch("");
    setOrderScope("room");
    setOrderStatus("ALL");
    setSection("orders");
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await logoutFromServer();
    } finally {
      setLoggingOut(false);
      navigate("/auth/login", { replace: true });
    }
  };

  const anyFetching = ordersQuery.isFetching || tablesQuery.isFetching ||
    todayReservations.isFetching || dailyReservations.isFetching;

  return (
    <div className="min-h-screen bg-[#131316] text-zinc-100">
      <header className="border-b border-white/[0.07] bg-[#1b1b1f]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-950 text-white shadow-lg shadow-red-950/40">
              <UtensilsCrossed size={23} />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-red-400">Restaurant Central / Personal</p>
              <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-white">Panel del mesero</h1>
              <p className="mt-0.5 text-xs text-zinc-400">{user?.fullName?.trim() || user?.username || "Personal del restaurante"} · Atención de sala</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={reload} disabled={anyFetching}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-50">
              <RefreshCw size={16} className={anyFetching ? "animate-spin" : ""} /> Actualizar
            </button>
            <button type="button" onClick={() => void logout()} disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 disabled:opacity-50">
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-8 lg:px-10">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Secciones del personal" className="flex max-w-full flex-wrap gap-2">
            {tabs.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => changeSection(id)}
                aria-current={section === id ? "page" : undefined}
                className={section === id
                  ? "inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white shadow-md shadow-red-950/30"
                  : "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#242428] px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-[#303035]"}>
                <Icon size={17} /> {label}
              </button>
            ))}
            <Link to="/driver" className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.075] px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/15">
              <Truck size={17} /> Mis repartos
            </Link>
          </nav>
          <Link to="/" className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white">
            <ArrowLeft size={15} /> Volver al restaurante
          </Link>
        </div>

        {(ordersQuery.isError || tablesQuery.isError || todayReservations.isError || (section === "reservations" && dailyReservations.isError)) && (
          <div role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <CircleAlert size={18} className="shrink-0" />
              <div>
                {ordersQuery.isError && <p>No se pudieron consultar los pedidos.</p>}
                {tablesQuery.isError && <p>No se pudieron consultar las mesas.</p>}
                {todayReservations.isError && <p>No se pudieron consultar las reservas de hoy.</p>}
                {section === "reservations" && dailyReservations.isError && selectedDate !== today && <p>No se pudieron consultar las reservas de la fecha seleccionada.</p>}
                <button type="button" onClick={reload} className="mt-2 font-bold underline underline-offset-4">Reintentar</button>
              </div>
            </div>
          </div>
        )}

        {section === "dashboard" && (
          <section aria-label="Resumen operativo de sala">
            <div className="relative mb-6 overflow-hidden rounded-[24px] border border-red-600/20 bg-gradient-to-r from-[#392027] via-[#291f24] to-[#242327] p-5 sm:p-7">
              <div className="pointer-events-none absolute -right-16 -top-28 h-64 w-64 rounded-full bg-red-600/15 blur-3xl" />
              <div className="relative flex flex-wrap items-center justify-between gap-5">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-red-300">
                    <Sparkles size={14} /> Centro de operaciones
                  </div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Todo listo para atender el salón</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-300">
                    Consulta las mesas, registra pedidos presenciales y revisa las próximas reservas desde un solo lugar.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <NewDineInOrder onCreated={onCreated} label="Nuevo pedido" />
                  <button type="button" onClick={() => changeSection("tables")}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15">
                    <Users size={17} /> Ver mesas
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Mesas ocupadas" value={tablesQuery.isPending || tablesQuery.isError ? "—" : occupiedTables.length}
                hint="Situación actual" Icon={Users} accent="amber" />
              <Kpi label="Pedidos en sala" value={ordersQuery.isPending || ordersQuery.isError ? "—" : openRoomOrders.length}
                hint="Pedidos presenciales activos" Icon={ClipboardList} accent="red" />
              <Kpi label="En preparación" value={ordersQuery.isPending || ordersQuery.isError ? "—" : openRoomOrders.filter((order) => order.statusCode === "IN_PROGRESS").length}
                hint="Pedidos de sala en cocina" Icon={ChefHat} accent="blue" />
              <Kpi label="Reservas de hoy" value={todayReservations.isPending || todayReservations.isError ? "—" : activeReservationsToday.length}
                hint="Pendientes o confirmadas" Icon={CalendarDays} accent="green" />
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(315px,1fr)]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/[0.09] bg-[#1c1c20] p-5">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Pedidos activos de sala</h2>
                      <p className="mt-1 text-xs text-zinc-400">Los pedidos de delivery y para llevar se consultan por separado.</p>
                    </div>
                    <button type="button" onClick={() => { setOrderScope("room"); setOrderSearch(""); changeSection("orders"); }}
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-red-300 hover:text-red-200">
                      Ver todos <ArrowRight size={15} />
                    </button>
                  </div>
                  {ordersQuery.isPending ? <p className="py-8 text-sm text-zinc-400">Cargando pedidos de sala...</p> :
                    ordersQuery.isError ? <p className="py-8 text-sm text-zinc-400">No se pudo cargar esta sección.</p> :
                      openRoomOrders.length === 0 ?
                        <Empty icon={Coffee} heading="Salón sin pedidos activos" detail="Cuando registres un pedido en una mesa, aparecerá aquí." /> :
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[...openRoomOrders].sort((a, b) => b.id - a.id).slice(0, 4).map((order) => (
                            <OrderCard key={order.id} order={order} compact />
                          ))}
                        </div>}
                </div>
                <div className="rounded-2xl border border-white/[0.09] bg-[#1c1c20] p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Estado del salón</h2>
                      <p className="mt-1 text-xs text-zinc-400">Disponibilidad actual de las mesas.</p>
                    </div>
                    <button type="button" onClick={() => changeSection("tables")} className="text-xs font-bold text-red-300 hover:text-red-200">Ver mapa de mesas</button>
                  </div>
                  {tablesQuery.isPending ? <p className="py-8 text-sm text-zinc-400">Cargando mesas...</p> :
                    tablesQuery.isError ? <p className="py-8 text-sm text-zinc-400">No se pudo consultar la disponibilidad.</p> :
                      tables.length === 0 ? <Empty icon={Users} heading="No hay mesas configuradas" detail="Las mesas registradas en el sistema aparecerán aquí." /> :
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {tables.slice(0, 6).map((table) => (
                            <button type="button" key={table.id} onClick={() => changeSection("tables")}
                              className="rounded-xl border border-white/10 bg-[#28282d] p-3 text-left transition hover:border-red-400/35">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-bold text-white">Mesa {table.alias || table.code || table.id}</span>
                                <span className={"mt-1 h-2 w-2 shrink-0 rounded-full " +
                                  (table.status === "FREE" ? "bg-emerald-400" :
                                    table.status === "OCCUPIED" ? "bg-amber-400" : "bg-sky-400")} />
                              </div>
                              <p className="mt-3 text-[11px] text-zinc-400">{table.status === "FREE" ? "Libre" : table.status === "OCCUPIED" ? "Ocupada" : "Reservada"}</p>
                            </button>
                          ))}
                        </div>}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-white/[0.09] bg-[#1c1c20] p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <BellRing size={18} className="text-red-300" />
                    <h2 className="text-lg font-extrabold text-white">Avisos de sala</h2>
                  </div>
                  <p className="mb-4 text-xs leading-5 text-zinc-400">Avisos calculados a partir de los pedidos y las reservas, sin notificaciones simuladas.</p>
                  <div className="space-y-3">
                    {ordersQuery.isPending || todayReservations.isPending ? <p className="text-sm text-zinc-500">Consultando actividad...</p> : (
                      <>
                        {openRoomOrders.filter((order) => ["PENDING", "PENDING_CONFIRMATION"].includes(order.statusCode)).slice(0, 2).map((order) => (
                          <button key={"pending-" + order.id} type="button" onClick={() => viewOrder(order.id)}
                            className="flex w-full items-start gap-3 rounded-xl border border-amber-400/10 bg-amber-500/[0.055] p-3 text-left hover:bg-amber-500/10">
                            <Clock3 size={17} className="mt-0.5 shrink-0 text-amber-300" />
                            <span><span className="block text-sm font-bold text-zinc-100">Pedido #{order.id} por confirmar</span>
                              <span className="mt-1 block text-xs text-zinc-400">Revisa el pedido de mesa y coordina el cobro con caja.</span></span>
                          </button>
                        ))}
                        {upcomingReservations.slice(0, 2).map((reservation) => (
                          <button key={"res-" + reservation.id} type="button" onClick={() => changeSection("reservations")}
                            className="flex w-full items-start gap-3 rounded-xl border border-sky-400/10 bg-sky-500/[0.045] p-3 text-left hover:bg-sky-500/10">
                            <CalendarDays size={17} className="mt-0.5 shrink-0 text-sky-300" />
                            <span><span className="block text-sm font-bold text-zinc-100">Reserva #{reservation.id} a las {reservation.reservationTime.slice(0, 5)}</span>
                              <span className="mt-1 block text-xs text-zinc-400">{reservation.contactName || reservation.customerName} · {reservation.numberOfPeople} personas</span></span>
                          </button>
                        ))}
                        {openRoomOrders.filter((order) => ["PENDING", "PENDING_CONFIRMATION"].includes(order.statusCode)).length === 0 &&
                          upcomingReservations.length === 0 && (
                            <p className="rounded-xl bg-white/[0.035] p-4 text-xs leading-6 text-zinc-400">
                              No hay avisos de sala pendientes en este momento.
                            </p>
                          )}
                      </>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.09] bg-[#1c1c20] p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h2 className="text-lg font-extrabold text-white">Próximas reservas</h2>
                    <button type="button" onClick={() => changeSection("reservations")} className="text-xs font-bold text-red-300 hover:text-red-200">Ver agenda</button>
                  </div>
                  {todayReservations.isPending ? <p className="text-sm text-zinc-400">Cargando reservas...</p> :
                    todayReservations.isError ? <p className="text-sm text-zinc-400">No se pudieron consultar las reservas.</p> :
                      upcomingReservations.length === 0 ? <p className="rounded-xl bg-white/[0.035] p-4 text-sm text-zinc-400">No quedan llegadas registradas para hoy.</p> :
                        <div className="space-y-3">
                          {upcomingReservations.slice(0, 4).map((reservation) => (
                            <div key={reservation.id} className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">
                              <span className="rounded-lg bg-red-500/10 p-2 text-red-300"><Clock3 size={18} /></span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-white">{reservation.contactName || reservation.customerName}</p>
                                <p className="mt-1 text-xs text-zinc-400">Mesa {reservation.tableNumber || "por asignar"} · {reservation.numberOfPeople} personas</p>
                              </div>
                              <span className="shrink-0 text-sm font-bold text-red-200">{reservation.reservationTime.slice(0, 5)}</span>
                            </div>
                          ))}
                        </div>}
                </div>
              </div>
            </div>
          </section>
        )}

        {section === "orders" && (
          <section aria-label="Gestión de pedidos">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-400">Servicio / Pedidos</p>
                <h2 className="mt-1 text-2xl font-extrabold text-white">Pedidos del restaurante</h2>
                <p className="mt-1 text-sm text-zinc-400">Los pedidos de mesa se muestran primero. Cocina prepara y caja registra pagos.</p>
              </div>
              <NewDineInOrder onCreated={onCreated} label="Nuevo pedido" />
            </div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#242428] p-1">
                {([
                  ["room", "Salón"],
                  ["other", "Otros canales"],
                  ["all", "Todos"],
                ] as [OrderScope, string][]).map(([scope, label]) => (
                  <button type="button" key={scope} onClick={() => { setOrderScope(scope); setOrderSearch(""); }}
                    aria-pressed={orderScope === scope}
                    className={orderScope === scope
                      ? "rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white"
                      : "rounded-lg px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-white/10 hover:text-white"}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-zinc-500">{filteredOrders.length} pedidos visibles</span>
            </div>
            <div className="mb-6 flex flex-wrap gap-3">
              <label className="flex min-w-[210px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#242428] px-3">
                <Search size={16} className="shrink-0 text-zinc-500" />
                <span className="sr-only">Buscar pedidos</span>
                <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="Buscar número, cliente o mesa..."
                  className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-zinc-500" />
              </label>
              <label className="flex items-center rounded-xl border border-white/10 bg-[#242428] px-3">
                <span className="sr-only">Filtrar por estado</span>
                <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}
                  className="max-w-[220px] bg-transparent py-3 text-sm text-zinc-200 outline-none">
                  <option value="ALL" className="bg-[#242428]">Todos los estados</option>
                  {roomStatuses.map((status) => (
                    <option key={status} value={status} className="bg-[#242428]">{statusLabel(status)}</option>
                  ))}
                </select>
              </label>
            </div>
            {ordersQuery.isPending ? <p className="py-10 text-center text-sm text-zinc-400">Cargando pedidos...</p> :
              ordersQuery.isError ? <Empty icon={CircleAlert} heading="No se pudieron cargar los pedidos" detail="Revisa la conexión y pulsa Actualizar." /> :
                filteredOrders.length === 0 ?
                  <Empty icon={ClipboardList} heading="No hay pedidos con estos filtros" detail={orderScope === "room" ? "Registra un nuevo pedido presencial o cambia los filtros." : "Prueba otra búsqueda o consulta los pedidos de sala."} /> :
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredOrders.map((order) => <OrderCard key={order.id} order={order} />)}
                  </div>}
            <p className="mt-5 text-xs text-zinc-500">Datos reales del servidor, actualizados cada 15 segundos. Los pagos se gestionan desde caja.</p>
          </section>
        )}

        {section === "tables" && (
          <section aria-label="Gestión de mesas">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-400">Servicio / Salón</p>
                <h2 className="mt-1 text-2xl font-extrabold text-white">Mapa de mesas</h2>
                <p className="mt-1 text-sm text-zinc-400">Consulta disponibilidad y registra pedidos desde una mesa libre.</p>
              </div>
              <NewDineInOrder onCreated={onCreated} label="Nuevo pedido" />
            </div>
            <div className="mb-6 flex flex-wrap gap-3">
              {[
                { label: "Libres", value: freeTables.length, dot: "bg-emerald-400" },
                { label: "Ocupadas", value: occupiedTables.length, dot: "bg-amber-400" },
                { label: "Reservadas", value: tables.filter((t) => t.status === "RESERVED").length, dot: "bg-sky-400" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#232327] px-4 py-3">
                  <span className={"h-2.5 w-2.5 rounded-full " + item.dot} />
                  <span className="text-sm text-zinc-400">{item.label}</span>
                  <strong className="text-sm text-white">{tablesQuery.isPending || tablesQuery.isError ? "—" : item.value}</strong>
                </div>
              ))}
            </div>
            {tablesQuery.isPending ? <p className="py-10 text-center text-sm text-zinc-400">Cargando mesas...</p> :
              tablesQuery.isError ? <Empty icon={CircleAlert} heading="No se pudieron consultar las mesas" detail="Intenta actualizar la página." /> :
                tables.length === 0 ?
                  <Empty icon={Users} heading="No hay mesas configuradas" detail="Cuando se registren mesas en el restaurante aparecerán aquí." /> :
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {tables.map((table) => (
                      <div key={table.id} className="flex flex-col rounded-2xl border border-white/10 bg-[#232327] p-5">
                        <div className="flex items-start justify-between gap-2">
                          <span className={"rounded-xl p-2.5 " + (table.status === "FREE" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300")}>
                            <UtensilsCrossed size={20} />
                          </span>
                          <StatusPill status={table.status} />
                        </div>
                        <h3 className="mt-4 text-lg font-extrabold text-white">Mesa {table.alias || table.code || table.id}</h3>
                        <p className="mt-1 text-xs text-zinc-400">{table.capacity} personas de capacidad</p>
                        <div className="mt-auto pt-5">
                          {table.activeOrderId != null ? (
                            <button type="button" onClick={() => viewOrder(table.activeOrderId!)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs font-bold text-zinc-200 hover:bg-white/10">
                              Pedido #{table.activeOrderId} <ArrowRight size={14} />
                            </button>
                          ) : table.status === "FREE" ? (
                            <NewDineInOrder onCreated={onCreated} defaultTableId={table.id} variant="outline" label="Crear pedido" />
                          ) : (
                            <span className="block rounded-xl bg-white/[0.035] px-3 py-3 text-center text-xs text-zinc-400">
                              {table.status === "RESERVED" ? "Mesa reservada" : "Mesa ocupada"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>}
            <p className="mt-5 text-xs leading-6 text-zinc-500">
              La disponibilidad proviene de la API. La ocupación cambia con los pedidos y las reservas; no se modifican estados manualmente desde esta pantalla.
            </p>
          </section>
        )}

        {section === "reservations" && (
          <section aria-label="Agenda de reservas">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-400">Servicio / Agenda</p>
                <h2 className="mt-1 text-2xl font-extrabold text-white">Reservas y llegadas</h2>
                <p className="mt-1 text-sm text-zinc-400">Consulta las mesas reservadas, los horarios y los datos de contacto registrados.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#242428] px-3">
                  <CalendarDays size={16} className="text-red-300" />
                  <span className="sr-only">Fecha de reservas</span>
                  <input type="date" value={selectedDate} onChange={(event) => {
                    if (event.target.value) { setSelectedDate(event.target.value); setReservationPage(0); }
                  }} className="bg-transparent py-3 text-sm text-white outline-none" />
                </label>
                <button type="button" onClick={() => { setSelectedDate(today); setReservationPage(0); }}
                  className="rounded-xl border border-white/10 px-3 py-3 text-xs font-semibold text-zinc-300 hover:bg-white/10">Hoy</button>
              </div>
            </div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-zinc-400">
                <span className="font-bold text-white">{prettyDate(selectedDate)}</span>
                {dailyReservations.data && <span className="ml-2">· {dailyReservations.data.totalElements} registros</span>}
              </p>
              <div className="inline-flex gap-1 rounded-xl border border-white/10 bg-[#242428] p-1">
                {([
                  ["active", "Pendientes y confirmadas"],
                  ["all", "Todas"],
                ] as [ReservationScope, string][]).map(([scope, label]) => (
                  <button type="button" key={scope} onClick={() => setReservationScope(scope)}
                    aria-pressed={scope === reservationScope}
                    className={scope === reservationScope
                      ? "rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white"
                      : "rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-white"}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {dailyReservations.isPending ? <p className="py-10 text-center text-sm text-zinc-400">Cargando reservas...</p> :
              dailyReservations.isError ?
                <Empty icon={CircleAlert} heading="No se pudo cargar la agenda" detail="Intenta cambiar de fecha o pulsa Actualizar." /> :
                displayedReservations.length === 0 ?
                  <Empty icon={CalendarDays} heading="Sin reservas para mostrar" detail="No hay reservas registradas con estos filtros para el día seleccionado." /> :
                  <div className="grid gap-4 md:grid-cols-2">
                    {displayedReservations.map((reservation) => (
                      <article key={reservation.id} className="rounded-2xl border border-white/10 bg-[#232327] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-red-300">Reserva #{reservation.id}</p>
                            <h3 className="mt-1 text-lg font-extrabold text-white">
                              {reservation.contactName || reservation.customerName || "Cliente sin nombre"}
                            </h3>
                          </div>
                          <StatusPill status={reservation.status} />
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
                          <div className="flex items-center gap-2 text-zinc-300"><Clock3 size={16} className="text-red-300" />{reservation.reservationTime.slice(0, 5)}</div>
                          <div className="flex items-center gap-2 text-zinc-300"><Users size={16} className="text-red-300" />{reservation.numberOfPeople} personas</div>
                          <div className="flex items-center gap-2 text-zinc-300"><MapPin size={16} className="text-red-300" />Mesa {reservation.tableNumber || "por confirmar"}</div>
                          <div className="text-xs text-zinc-400">{reservation.contactPhone || "Sin teléfono de contacto"}</div>
                        </div>
                      </article>
                    ))}
                  </div>}
            {(dailyReservations.data?.totalPages || 0) > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <button type="button" disabled={reservationPage === 0} onClick={() => setReservationPage((page) => Math.max(0, page - 1))}
                  className="rounded-xl border border-white/10 p-2.5 disabled:opacity-30" aria-label="Página anterior">
                  <ChevronLeft size={19} />
                </button>
                <span className="text-sm text-zinc-400">Página {reservationPage + 1} de {dailyReservations.data?.totalPages}</span>
                <button type="button" disabled={reservationPage + 1 >= (dailyReservations.data?.totalPages || 1)}
                  onClick={() => setReservationPage((page) => page + 1)}
                  className="rounded-xl border border-white/10 p-2.5 disabled:opacity-30" aria-label="Página siguiente">
                  <ChevronRight size={19} />
                </button>
              </div>
            )}
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-xs leading-6 text-zinc-400">
              <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-400" />
              Esta agenda muestra reservas reales del sistema. No confirma, cancela ni marca asistencia de forma automática.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
