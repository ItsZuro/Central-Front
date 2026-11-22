import Sidebar from "@/components/Sidebar/Sidebar";
import { Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="border-b border-slate-200 bg-white/80 px-5 py-3 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between text-xs">
            <div className="font-semibold text-slate-500">Restaurant Central <span className="mx-2 text-slate-300">/</span> Administración</div>
            <div className="flex items-center gap-2 font-medium text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Panel de gestión</div>
          </div>
        </div>
        <div className="px-4 py-7 sm:px-8 sm:py-9">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
