import { api } from "@/core/api/api";
import axios from "axios";
import { FolderPlus, Pencil, Tags, Trash2, UtensilsCrossed, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

interface Category {
  id: number;
  name: string;
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || "No fue posible completar la operación.";
  }
  return "Ocurrió un error inesperado.";
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Category | null | "new">(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("categories");
      setCategories(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (category?: Category) => {
    setName(category?.name || "");
    setEditor(category || "new");
    setError("");
    setNotice("");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return setError("Escribe el nombre de la categoría.");
    if (categories.some((category) => category.name.toLowerCase() === value.toLowerCase() && (editor === "new" || category.id !== editor?.id))) {
      return setError("Ya existe una categoría con ese nombre.");
    }
    setBusy(true);
    setError("");
    try {
      if (editor === "new") {
        await api.post("categories", { name: value });
        setNotice("Categoría creada correctamente.");
      } else if (editor) {
        await api.put("categories/" + editor.id, { name: value });
        setNotice("Categoría actualizada correctamente.");
      }
      setEditor(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (category: Category) => {
    if (!window.confirm("¿Eliminar la categoría '" + category.name + "'? Si tiene productos asociados, el servidor puede impedirlo.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.delete("categories/" + category.id);
      setNotice("Categoría eliminada.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-red-600">Catálogo · Configuración</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Categorías</h1>
          <p className="mt-2 text-sm text-slate-500">Organiza los platos y bebidas que verá el cliente en el menú.</p>
        </div>
        <button onClick={() => open()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700">
          <FolderPlus size={18} /> Nueva categoría
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600"><Tags size={23} /></div>
          <p className="mt-5 text-sm font-medium text-slate-500">Categorías registradas</p>
          <p className="mt-1 text-4xl font-extrabold text-slate-900">{loading ? "…" : categories.length}</p>
          <p className="mt-3 text-xs text-slate-500">Datos reales de PostgreSQL (RDS)</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-600 to-red-800 p-6 text-white shadow-sm md:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-100"><UtensilsCrossed size={18} /> Configuración del menú</div>
          <h2 className="mt-4 text-xl font-bold">Primero crea categorías; después añade tus platos.</h2>
          <p className="mt-2 max-w-xl text-sm text-red-100">Por ejemplo: Platos principales, Entradas, Bebidas y Postres. Cada producto necesita una categoría para poder guardarse.</p>
          <Link className="mt-5 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50" to="/admin/products">Ir a productos</Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="font-bold text-slate-900">Listado de categorías</h2>
            <p className="mt-1 text-xs text-slate-500">Añade, modifica o elimina categorías del restaurante.</p>
          </div>
        </div>
        {loading ? <p className="p-10 text-center text-sm text-slate-500">Cargando categorías…</p> : categories.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="rounded-2xl bg-red-50 p-5 text-red-600"><Tags size={32} /></div>
            <h3 className="mt-5 text-lg font-bold text-slate-900">Aún no hay categorías</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">Crea la primera para habilitar el registro de productos en el panel de administración.</p>
            <button onClick={() => open()} className="mt-5 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Crear primera categoría</button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><Tags size={18} /></span>
                  <div><p className="truncate font-semibold text-slate-900">{category.name}</p><p className="text-xs text-slate-400">ID #{category.id}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <button aria-label={"Editar " + category.name} onClick={() => open(category)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-red-200 hover:text-red-600"><Pencil size={17} /></button>
                  <button aria-label={"Eliminar " + category.name} disabled={busy} onClick={() => void remove(category)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-red-200 hover:text-red-600 disabled:opacity-50"><Trash2 size={17} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditor(null); }}>
          <form onSubmit={(event) => void save(event)} role="dialog" aria-modal="true" aria-label={editor === "new" ? "Nueva categoría" : "Editar categoría"} className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-7 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">{editor === "new" ? "Nueva categoría" : "Editar categoría"}</h2><button type="button" aria-label="Cerrar" onClick={() => setEditor(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
            <div><label htmlFor="category-name" className="mb-2 block text-sm font-medium text-slate-700">Nombre de la categoría</label><input id="category-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Ej. Platos principales" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" required /></div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setEditor(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button><button disabled={busy} type="submit" className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy ? "Guardando…" : "Guardar categoría"}</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
