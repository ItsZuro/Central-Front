import { api } from "@/core/api/api";
import { ArrowRight, ChartNoAxesCombined, CircleCheck, PackageOpen, Plus, ShieldCheck, Tags, UtensilsCrossed, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  price: number;
  categoryName?: string;
  active: boolean;
}

interface Stats {
  products: Product[];
  categories: number;
  users: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [p, c, u] = await Promise.all([
          api.get("products/all"),
          api.get("categories"),
          api.get("users/admin"),
        ]);
        if (active) setStats({
          products: Array.isArray(p.data?.data) ? p.data.data : [],
          categories: Array.isArray(c.data?.data) ? c.data.data.length : 0,
          users: Array.isArray(u.data?.data) ? u.data.data.length : 0,
        });
      } catch {
        if (active) setError("No se pudieron cargar todos los indicadores. Comprueba la sesión y la conexión con el backend.");
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const activeProducts = stats?.products.filter((p) => p.active).length ?? 0;
  const metrics = [
    { title: "Platos registrados", value: stats?.products.length, icon: UtensilsCrossed, to: "/admin/products", sub: "Total en el catálogo" },
    { title: "Platos publicados", value: activeProducts, icon: CircleCheck, to: "/admin/products", sub: "Visibles para clientes" },
    { title: "Categorías", value: stats?.categories, icon: Tags, to: "/admin/categories", sub: "Familias del menú" },
    { title: "Usuarios", value: stats?.users, icon: UsersRound, to: "/admin/users", sub: "Cuentas registradas" },
  ];
  const steps = [
    { title: "Crear categorías", detail: "Entradas, platos principales, bebidas y postres.", to: "/admin/categories", complete: (stats?.categories ?? 0) > 0 },
    { title: "Registrar productos", detail: "Añade descripciones, precios e imágenes.", to: "/admin/products", complete: (stats?.products.length ?? 0) > 0 },
    { title: "Revisar usuarios", detail: "Verifica las cuentas disponibles y sus roles.", to: "/admin/users", complete: (stats?.users ?? 0) > 1 },
  ];

  return (
    <section className="mx-auto max-w-7xl space-y-7">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#af0914] via-[#d61020] to-[#f04d3d] p-7 text-white shadow-xl shadow-red-100 sm:p-10">
        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[50px] border-white/10" />
        <div className="pointer-events-none absolute bottom-[-100px] right-40 h-52 w-52 rounded-full bg-white/5" />
        <div className="relative z-10 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide"><ShieldCheck size={15} /> RESTAURANT CENTRAL · ADMIN</div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Tu restaurante, bajo control.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-red-50 sm:text-base">Gestiona el catálogo, organiza los platos y administra tu equipo desde un solo lugar. Los indicadores proceden de tu API.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/admin/products" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-sm hover:bg-red-50"><Plus size={18} /> Gestionar menú</Link>
            <Link to="/admin/reports" className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/20"><ChartNoAxesCombined size={18} /> Ver reportes</Link>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Link to={metric.to} key={metric.title} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-100 hover:shadow-md">
            <div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><metric.icon size={22} /></span><ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-red-600" /></div>
            <p className="mt-5 text-sm font-semibold text-slate-600">{metric.title}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">{stats ? metric.value : "…"}</p>
            <p className="mt-2 text-xs text-slate-400">{metric.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Primeros pasos</p><h2 className="mt-2 text-xl font-extrabold text-slate-900">Prepara tu restaurante</h2></div><span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{steps.filter((step) => step.complete).length} de {steps.length}</span></div>
          <p className="mt-2 text-sm text-slate-500">Completa estas tareas para habilitar las principales funciones del sistema.</p>
          <div className="mt-6 space-y-3">{steps.map((step, i) => <Link key={step.title} to={step.to} className="group flex items-center gap-4 rounded-xl border border-slate-100 p-4 transition hover:border-red-100 hover:bg-red-50/40">
            <span className={step.complete ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 font-bold text-emerald-600" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-600"}>{step.complete ? <CircleCheck size={20} /> : String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{step.title}</p><p className="mt-1 text-xs text-slate-500">{step.detail}</p></div>
            <ArrowRight size={16} className="text-slate-400 group-hover:text-red-600" />
          </Link>)}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Catálogo</p><h2 className="mt-2 text-xl font-extrabold text-slate-900">Últimos productos</h2></div><Link to="/admin/products" className="text-sm font-semibold text-red-600 hover:underline">Ver todos</Link></div>
          <p className="mt-2 text-sm text-slate-500">Productos actualmente registrados en PostgreSQL.</p>
          {stats && stats.products.length > 0 ? (
            <div className="mt-5 divide-y divide-slate-100">
              {stats.products.slice(-5).reverse().map((product) => <div key={product.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><UtensilsCrossed size={19} /></span><div><p className="font-semibold text-slate-900">{product.name}</p><p className="text-xs text-slate-400">{product.categoryName || "Sin categoría"} · {product.active ? "Publicado" : "Oculto"}</p></div></div>
                <span className="whitespace-nowrap font-bold text-slate-900">S/ {Number(product.price).toFixed(2)}</span>
              </div>)}
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center rounded-2xl bg-slate-50 px-5 py-12 text-center">
              <PackageOpen size={36} className="text-slate-300" />
              <p className="mt-4 font-semibold text-slate-700">Aún no hay platos registrados</p>
              <p className="mt-2 text-xs text-slate-500">Cuando agregues productos, aparecerán aquí.</p>
              <Link to="/admin/products" className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white">Ir al menú</Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
