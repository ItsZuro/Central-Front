import { useAuthStore } from "@/core/stores/auth/auth.store";
import { logoutFromServer } from "@/core/services/auth/logout";
import { ChartNoAxesCombined, ChevronRight, LayoutDashboard, LogOut, Menu, ShieldCheck, Tags, UtensilsCrossed, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

const links = [
  { label: "Resumen", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Productos", to: "/admin/products", icon: UtensilsCrossed },
  { label: "Categorías", to: "/admin/categories", icon: Tags },
  { label: "Reportes", to: "/admin/reports", icon: ChartNoAxesCombined },
  { label: "Usuarios", to: "/admin/users", icon: UsersRound },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutFromServer();
    } finally {
      setLoggingOut(false);
      navigate("/auth/login", { replace: true });
    }
  };

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:hidden">
        <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 font-extrabold text-white">C</span><span className="text-base font-extrabold text-slate-900">CENTRAL <span className="text-red-600">ADMIN</span></span></div>
        <button type="button" aria-label="Abrir menú" onClick={() => setOpen(true)} className="rounded-xl border border-slate-200 p-2 text-slate-700"><Menu size={22} /></button>
      </div>

      {open && <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 md:hidden" />}

      <aside className={(open ? "fixed inset-y-0 left-0 z-50 flex " : "hidden ") + "w-72 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-6 md:sticky md:top-0 md:flex md:h-screen"}>
        <div>
          <div className="mb-10 flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-800 text-lg font-extrabold text-white shadow-lg shadow-red-100">C</span>
              <div><div className="text-lg font-black tracking-tight text-slate-900">CENTRAL</div><div className="text-[10px] font-bold uppercase tracking-[0.24em] text-red-600">Administración</div></div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar navegación" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"><X size={20} /></button>
          </div>

          <div className="mb-9 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 p-4 text-white shadow-sm">
            <div className="mb-4 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-100">Panel de control</span><ShieldCheck size={19} className="text-red-100" /></div>
            <p className="truncate text-base font-bold">{user?.fullName || user?.username || "Administrador"}</p>
            <p className="mt-1 text-xs text-red-100">Gestión de Restaurant Central</p>
          </div>

          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Menú principal</p>
          <nav className="space-y-1.5" aria-label="Navegación de administración">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink key={link.to} to={link.to} onClick={() => setOpen(false)} className={({ isActive }) => "group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition " + (isActive ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
                  {({ isActive }) => (
                    <>
                      <Icon size={19} className={isActive ? "text-red-600" : "text-slate-400 group-hover:text-red-600"} />
                      <span className="flex-1">{link.label}</span>
                      {isActive && <ChevronRight size={16} className="text-red-500" />}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500"><div className="font-bold text-slate-800">Restaurant Central</div><div className="mt-1">Sistema de administración</div></div>
          <button type="button" disabled={loggingOut} onClick={() => void handleLogout()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"><LogOut size={18} /> {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}</button>
        </div>
      </aside>
    </>
  );
}
