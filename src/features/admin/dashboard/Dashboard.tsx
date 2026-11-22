import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { Activity, AlertTriangle, ArrowRight, CalendarDays, ChartNoAxesCombined, CircleCheck, ClipboardList, Coffee, PackageOpen, Plus, RefreshCw, ShoppingBag, Tags, TrendingUp, UserRound, UsersRound, UtensilsCrossed } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  categoryName?: string;
  price: number;
  active: boolean;
}

interface TopProduct {
  productId: number;
  productName: string;
  totalQuantitySold: number;
  totalRevenue: number;
}

interface Summary {
  totalOrders: number;
  totalSales: number;
  ordersToday: number;
  salesToday: number;
  topProducts: TopProduct[];
  salesLast7Days: Record<string, number>;
  ordersLast7Days: Record<string, number>;
}

interface InventoryItem {
  ingredientId: number;
  ingredientName: string;
  currentStock: number;
  minimumStock: number;
  status: string;
  unitName: string;
}

interface AdminData {
  products: Product[] | null;
  categories: number | null;
  users: number | null;
  summary: Summary | null;
  inventory: InventoryItem[] | null;
}

const money = (value: number) =>
  "S/ " + Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dayLabel = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("es-PE", { weekday: "short", day: "numeric" });
};

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.roles?.includes("ROLE_ADMIN"));
  const [state, setState] = useState<AdminData>({ products: null, categories: null, users: null, summary: null, inventory: null });
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    setPending(true);
    const results = await Promise.allSettled([
      api.get("reports/summary"),
      api.get("products/all"),
      api.get("categories"),
      isAdmin ? api.get("users/admin") : Promise.resolve({ data: { data: null } }),
      api.get("reports/inventory"),
    ]);
    const [summary, products, categories, users, inventory] = results;
    const failures: string[] = [];
    if (summary.status === "rejected") failures.push("reportes");
    if (products.status === "rejected") failures.push("productos");
    if (categories.status === "rejected") failures.push("categorías");
    if (isAdmin && users.status === "rejected") failures.push("usuarios");
    if (inventory.status === "rejected") failures.push("inventario");

    setState({
      summary: summary.status === "fulfilled" ? summary.value.data?.data || null : null,
      products: products.status === "fulfilled" && Array.isArray(products.value.data?.data) ? products.value.data.data : null,
      categories: categories.status === "fulfilled" && Array.isArray(categories.value.data?.data) ? categories.value.data.data.length : null,
      users: users.status === "fulfilled" && Array.isArray(users.value.data?.data) ? users.value.data.data.length : null,
      inventory: inventory.status === "fulfilled" && Array.isArray(inventory.value.data?.data) ? inventory.value.data.data : null,
    });
    setFailed(failures);
    setPending(false);
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load, refresh]);

  const chartData = useMemo(() => {
    const sales = state.summary?.salesLast7Days || {};
    const orders = state.summary?.ordersLast7Days || {};
    return Array.from(new Set([...Object.keys(sales), ...Object.keys(orders)]))
      .sort()
      .map((date) => ({
        date,
        label: dayLabel(date),
        sales: Number(sales[date] || 0),
        orders: Number(orders[date] || 0),
      }));
  }, [state.summary]);

  const lowStock = useMemo(() =>
    state.inventory?.filter((item) => ["BAJO", "CRÍTICO", "CRITICO"].includes(String(item.status).toUpperCase())) || [],
  [state.inventory]);
  const activeProducts = state.products?.filter((product) => product.active).length;
  const hasSales = chartData.some((point) => point.sales > 0);

  const cards = [
    { label: "Ventas de hoy", value: state.summary ? money(state.summary.salesToday) : "—", detail: "Ingresos registrados hoy", icon: TrendingUp, iconColor: "text-emerald-700", iconBg: "bg-emerald-50", to: "/admin/reports" },
    { label: "Pedidos de hoy", value: state.summary ? String(state.summary.ordersToday) : "—", detail: state.summary ? `${state.summary.totalOrders} pedidos históricos` : "Conectado a reportes", icon: ShoppingBag, iconColor: "text-blue-700", iconBg: "bg-blue-50", to: "/admin/reports" },
    { label: "Productos activos", value: activeProducts == null ? "—" : String(activeProducts), detail: state.products ? `${state.products.length} registrados en total` : "Catálogo del restaurante", icon: UtensilsCrossed, iconColor: "text-red-700", iconBg: "bg-red-50", to: "/admin/products" },
    { label: "Alertas de stock", value: state.inventory ? String(lowStock.length) : "—", detail: state.inventory ? (lowStock.length ? "Requieren revisión" : "Sin alertas registradas") : "Inventario", icon: AlertTriangle, iconColor: "text-amber-700", iconBg: "bg-amber-50", to: "/admin/reports" },
  ];

  const tools = [
    { label: "Agregar producto", help: "Actualizar catálogo", icon: Plus, to: "/admin/products" },
    { label: "Crear categoría", help: "Organizar menú", icon: Tags, to: "/admin/categories" },
    ...(isAdmin ? [{ label: "Administrar usuarios", help: "Equipo y permisos", icon: UsersRound, to: "/admin/users" }] : []),
    { label: "Mi perfil", help: "Datos y seguridad", icon: UserRound, to: "/admin/profile" },
  ];

  return (
    <section className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Restaurant Central / Administración</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Resumen operativo</h1>
          <p className="mt-2 text-sm text-slate-500">Bienvenido, {user?.firstName || user?.username || "administrador"}. Consulta el estado real de tu restaurante.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRefresh((n) => n + 1)} disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-50">
            <RefreshCw size={16} className={pending ? "animate-spin" : ""} /> Actualizar
          </button>
          <Link to="/admin/products" className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700"><Plus size={17} /> Nuevo plato</Link>
        </div>
      </header>

      {failed.length > 0 && <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"><AlertTriangle size={19} className="mt-0.5 shrink-0"/> No fue posible consultar {failed.join(", ")}. Los datos no disponibles se muestran con «—». Puedes intentar actualizar.</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <Link key={card.label} to={card.to} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-red-200 hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.iconBg} ${card.iconColor}`}><card.icon size={22}/></span>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-red-500"/>
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">{card.label}</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{pending ? "…" : card.value}</p>
          <p className="mt-2 text-xs text-slate-400">{card.detail}</p>
        </Link>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ChartNoAxesCombined size={21} className="text-red-600"/> Evolución de ventas</h2>
              <p className="mt-1 text-xs text-slate-500">Últimos siete días · Datos reales de pedidos</p>
            </div>
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><CalendarDays size={14} className="mr-1 inline"/> 7 días</div>
          </div>

          {state.summary && hasSales ? (
            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 15, left: -12, bottom: 0 }}>
                  <defs><linearGradient id="central-sales-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dc2626" stopOpacity={0.22}/><stop offset="95%" stopColor="#dc2626" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="#eef0f4" strokeDasharray="3 3"/>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip formatter={(value) => money(Number(value))} labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.date || "")}/>
                  <Area type="monotone" dataKey="sales" name="Ventas" stroke="#dc2626" strokeWidth={3} fill="url(#central-sales-gradient)" activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-5 flex h-64 flex-col items-center justify-center rounded-xl bg-slate-50 text-center"><Activity size={31} className="text-slate-300"/><p className="mt-3 font-semibold text-slate-600">{pending ? "Cargando ventas…" : !state.summary ? "Reportes no disponibles" : "Aún no se registran ventas"}</p><p className="mt-1 text-xs text-slate-400">El gráfico se completará con los pedidos reales.</p></div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5">
            <div><p className="text-xs text-slate-500">Ventas acumuladas</p><p className="mt-1 text-lg font-extrabold text-slate-900">{state.summary ? money(state.summary.totalSales) : "—"}</p></div>
            <div><p className="text-xs text-slate-500">Total de pedidos</p><p className="mt-1 text-lg font-extrabold text-slate-900">{state.summary ? state.summary.totalOrders : "—"}</p></div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardList size={21} className="text-red-600"/> Acciones rápidas</h2><p className="mt-1 text-xs text-slate-500">Herramientas de administración</p></div>
          <div className="mt-6 space-y-3">
            {tools.map((action) => <Link key={action.label} to={action.to} className="group flex items-center gap-4 rounded-xl border border-slate-100 p-4 transition hover:border-red-100 hover:bg-red-50/40">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 group-hover:bg-red-50 group-hover:text-red-700"><action.icon size={20}/></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{action.label}</span><span className="mt-1 block text-xs text-slate-500">{action.help}</span></span>
              <ArrowRight size={17} className="text-slate-300 group-hover:text-red-500"/>
            </Link>)}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Coffee size={21} className="text-red-600"/> Platos más vendidos</h2><p className="mt-1 text-xs text-slate-500">Ordenados por unidades vendidas</p></div><Link className="text-xs font-bold text-red-700 hover:underline" to="/admin/reports">Ver reportes</Link></div>
          {state.summary?.topProducts?.length ? (
            <div className="mt-5 divide-y divide-slate-100">
              {state.summary.topProducts.slice(0,5).map((item, index) => <div key={item.productId} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-xs font-black text-red-700">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{item.productName}</p><p className="text-xs text-slate-500">{item.totalQuantitySold} unidades</p></div>
                <strong className="text-sm text-slate-900">{money(item.totalRevenue)}</strong>
              </div>)}
            </div>
          ) : (
            <div className="mt-5 flex flex-col items-center rounded-xl bg-slate-50 px-5 py-12 text-center"><PackageOpen size={29} className="text-slate-300"/><p className="mt-3 text-sm font-semibold text-slate-600">Sin productos vendidos todavía</p><p className="mt-2 text-xs text-slate-400">Aparecerán aquí después de los primeros pedidos.</p></div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><AlertTriangle size={21} className="text-amber-600"/> Estado de inventario</h2><p className="mt-1 text-xs text-slate-500">Ingredientes que requieren reposición</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{state.inventory?.length ?? "—"} registrados</span></div>
          {lowStock.length ? (
            <div className="mt-5 divide-y divide-slate-100">
              {lowStock.slice(0,5).map((item) => <div key={item.ingredientId} className="flex items-center gap-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><AlertTriangle size={17}/></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{item.ingredientName}</p><p className="mt-1 text-xs text-slate-500">Stock: {item.currentStock} · Mínimo: {item.minimumStock}</p></div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{item.status}</span>
              </div>)}
            </div>
          ) : (
            <div className="mt-5 flex flex-col items-center rounded-xl bg-slate-50 px-5 py-12 text-center"><CircleCheck size={30} className="text-emerald-500"/><p className="mt-3 text-sm font-semibold text-slate-700">{state.inventory ? "No hay alertas de inventario" : "Inventario no disponible"}</p><p className="mt-2 text-xs text-slate-400">{state.inventory ? "Las existencias están por encima del mínimo configurado." : "Consulta de inventario pendiente."}</p></div>
          )}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500">
        <p><CircleCheck size={15} className="mr-2 inline text-emerald-500"/> Panel conectado a Restaurant Central · AWS</p>
        <p>{state.users == null ? "Usuarios: —" : `Usuarios: ${state.users}`} · {state.categories == null ? "Categorías: —" : `Categorías: ${state.categories}`}</p>
      </footer>
    </section>
  );
}
