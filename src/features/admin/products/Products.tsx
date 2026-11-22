import { api } from "@/core/api/api";
import axios from "axios";
import { toast } from "react-toastify";
import { CheckCircle2, CircleOff, Clock3, ImageOff, Pencil, Plus, Search, Tags, Trash2, UtensilsCrossed, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  categoryId: number;
  categoryName?: string;
  preparationTimeMinutes: number;
  active: boolean;
  isCombo?: boolean;
  ingredients?: Array<{ ingredientId: number; quantity: number }>;
  extras?: Array<{ name: string; price: number }>;
  comboItems?: Array<{ simpleProductId: number; quantity: number }>;
}

interface Category {
  id: number;
  name: string;
}

type ProductForm = Omit<Product, "id" | "categoryName">;

const blankProduct = (): ProductForm => ({
  name: "",
  description: "",
  price: 0,
  imageUrl: "",
  categoryId: 0,
  preparationTimeMinutes: 15,
  active: true,
  isCombo: false,
});

const priceLabel = (value: number) => "S/ " + Number(value || 0).toFixed(2);

function errorText(error: unknown) {
  if (axios.isAxiosError<{ message?: string; errors?: Record<string, string> }>(error)) {
    const message = error.response?.data?.message;
    const details = error.response?.data?.errors;
    if (details && typeof details === "object") return Object.values(details).join(" · ");
    return message || "No se pudo completar la operación. Revisa los campos y permisos.";
  }
  return "Ocurrió un error inesperado.";
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<ProductForm>(blankProduct());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productRes, categoryRes] = await Promise.all([
        api.get("products/all"),
        api.get("categories"),
      ]);
      setProducts(Array.isArray(productRes.data?.data) ? productRes.data.data : []);
      setCategories(Array.isArray(categoryRes.data?.data) ? categoryRes.data.data : []);
    } catch (err) {
      setError(errorText(err));
      toast.error(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => products.filter((product) => {
    if (status === "active" && !product.active) return false;
    if (status === "inactive" && product.active) return false;
    const categoryName = product.categoryName || categories.find((c) => c.id === product.categoryId)?.name || "";
    return (product.name + " " + product.description + " " + categoryName).toLowerCase().includes(query.trim().toLowerCase());
  }), [products, categories, status, query]);

  const openNew = () => {
    setError("");
    setEditingId("new");
    setForm({ ...blankProduct(), categoryId: categories[0]?.id ?? 0 });
  };
  const openEdit = (product: Product) => {
    if (product.isCombo) {
      setError("La edición de combos necesita una pantalla específica. Puedes ocultarlo o eliminarlo, pero no convertirlo accidentalmente en un plato simple.");
      return;
    }
    setError("");
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description || "",
      price: Number(product.price),
      imageUrl: product.imageUrl || "",
      categoryId: product.categoryId,
      preparationTimeMinutes: product.preparationTimeMinutes || 15,
      active: product.active,
      isCombo: Boolean(product.isCombo),
    });
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.description.trim()) return setError("Nombre y descripción son obligatorios.");
    if (!categories.some((category) => category.id === Number(form.categoryId))) return setError("Selecciona una categoría válida.");
    if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) return setError("El precio debe ser cero o mayor.");
    if (!Number.isInteger(Number(form.preparationTimeMinutes)) || Number(form.preparationTimeMinutes) < 1) return setError("El tiempo de preparación debe ser al menos un minuto.");
    if (form.imageUrl && !/^https?:\/\//i.test(form.imageUrl)) return setError("Introduce una URL de imagen válida.");
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        imageUrl: form.imageUrl?.trim() || null,
        categoryId: Number(form.categoryId),
        preparationTimeMinutes: Number(form.preparationTimeMinutes),
        active: Boolean(form.active),
        isCombo: false,
        // El backend conserva ingredientes y extras cuando se omiten en ediciones básicas.
        ingredients: editingId === "new" ? [] : undefined,
        comboItems: editingId === "new" ? [] : undefined,
        extras: editingId === "new" ? [] : undefined,
      };
      if (editingId === "new") {
        await api.post("products", payload);
        setNotice("Plato registrado correctamente.");
      toast.success("Plato registrado correctamente.");
      } else if (typeof editingId === "number") {
        await api.put("products/" + editingId, payload);
        setNotice("Producto actualizado correctamente.");
      toast.success("Producto actualizado correctamente.");
      }
      setEditingId(null);
      await load();
    } catch (err) {
      setError(errorText(err));
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: Product) => {
    setError("");
    setNotice("");
    try {
      await api.patch("products/" + product.id + "/toggle-active");
      setNotice(product.active ? "Producto ocultado del menú público." : "Producto publicado en el menú.");
      toast.success(product.active ? "Producto ocultado del menú público." : "Producto publicado en el menú.");
      await load();
    } catch (err) {
      setError(errorText(err));
      toast.error(errorText(err));
    }
  };

  const remove = async (product: Product) => {
    if (!window.confirm("¿Eliminar '" + product.name + "'? Esta acción puede ser irreversible y fallará si tiene pedidos asociados.")) return;
    setError("");
    setNotice("");
    try {
      await api.delete("products/" + product.id);
      setNotice("Producto eliminado.");
      toast.success("Producto eliminado.");
      await load();
    } catch (err) {
      setError(errorText(err));
      toast.error(errorText(err));
    }
  };

  const activeCount = products.filter((p) => p.active).length;
  return (
    <section className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-red-600">Catálogo · Restaurant Central</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Gestión del menú</h1>
          <p className="mt-2 text-sm text-slate-500">Administra los platos que aparecen en la web de tu restaurante.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/categories" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-red-200 hover:text-red-700"><Tags size={17} /> Categorías</Link>
          <button onClick={openNew} disabled={categories.length === 0} title={categories.length === 0 ? "Crea primero una categoría" : "Añadir producto"} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={18} /> Nuevo plato</button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Productos registrados", value: products.length, icon: UtensilsCrossed },
          { label: "Productos visibles", value: activeCount, icon: CheckCircle2 },
          { label: "Categorías", value: categories.length, icon: Tags },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="rounded-xl bg-red-50 p-3 text-red-600"><item.icon size={22} /></div>
            <div><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{loading ? "…" : item.value}</p></div>
          </div>
        ))}
      </div>

      {categories.length === 0 && !loading && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-bold text-amber-900">Primero necesitamos categorías</p><p className="mt-1 text-sm text-amber-800">Sin categorías, Spring Boot no permite registrar productos.</p></div>
          <Link to="/admin/categories" className="shrink-0 rounded-xl bg-amber-900 px-4 py-2.5 text-center text-sm font-semibold text-white">Crear categoría</Link>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-base font-bold text-slate-900">Todos los platos</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} resultado(s)</p></div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-slate-500"><Search size={16} /><input aria-label="Buscar productos" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar plato…" className="w-40 bg-transparent py-2.5 text-sm text-slate-900 outline-none sm:w-52" /></label>
            <select aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value as "all" | "active" | "inactive")} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600"><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select>
          </div>
        </div>

        {loading ? <div className="p-12 text-center text-sm text-slate-500">Cargando productos…</div> : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="rounded-2xl bg-red-50 p-5 text-red-600"><UtensilsCrossed size={30} /></div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">{products.length ? "No se encontraron platos" : "Todavía no tienes productos"}</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">{products.length ? "Prueba con otra búsqueda o filtro." : "Crea tus categorías y registra los platos para que aparezcan automáticamente en la web."}</p>
            {!products.length && categories.length > 0 && <button onClick={openNew} className="mt-5 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white">Agregar primer plato</button>}
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-4 font-semibold">Producto</th><th className="px-6 py-4 font-semibold">Categoría</th><th className="px-6 py-4 font-semibold">Precio</th><th className="px-6 py-4 font-semibold">Preparación</th><th className="px-6 py-4 font-semibold">Estado</th><th className="px-6 py-4 text-right font-semibold">Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/70">
                  <td className="min-w-60 px-6 py-4"><div className="flex items-center gap-3">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><ImageOff size={19} /></span>}<div><div className="font-semibold text-slate-900">{product.name}</div><div className="mt-1 max-w-xs truncate text-xs text-slate-500">{product.description}</div></div></div></td>
                  <td className="px-6 py-4 text-slate-600">{product.categoryName || categories.find((c) => c.id === product.categoryId)?.name || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">{priceLabel(product.price)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 size={14} /> {product.preparationTimeMinutes} min</span></td>
                  <td className="px-6 py-4"><span className={product.active ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"}>{product.active ? "Publicado" : "Oculto"}</span></td>
                  <td className="whitespace-nowrap px-6 py-4 text-right"><div className="inline-flex items-center gap-1">
                    <button title="Editar" aria-label={"Editar " + product.name} onClick={() => openEdit(product)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Pencil size={17} /></button>
                    <button title={product.active ? "Ocultar" : "Publicar"} aria-label={(product.active ? "Ocultar " : "Publicar ") + product.name} onClick={() => void toggleActive(product)} className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700">{product.active ? <CircleOff size={17} /> : <CheckCircle2 size={17} />}</button>
                    <button title="Eliminar" aria-label={"Eliminar " + product.name} onClick={() => void remove(product)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {editingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target && !saving) setEditingId(null); }} role="presentation">
          <form onSubmit={(event) => void save(event)} role="dialog" aria-modal="true" aria-label={editingId === "new" ? "Crear producto" : "Editar producto"} className="my-auto w-full max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-red-600">Catálogo</p><h2 className="mt-2 text-2xl font-bold text-slate-900">{editingId === "new" ? "Nuevo plato" : "Editar plato"}</h2></div><button type="button" aria-label="Cerrar" onClick={() => setEditingId(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">Nombre del plato *<input required maxLength={150} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Lomo saltado" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="block text-sm font-semibold text-slate-700">Categoría *<select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none focus:border-red-500"><option value={0}>Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="block text-sm font-semibold text-slate-700">Precio (S/) *<input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="block text-sm font-semibold text-slate-700">Tiempo de preparación (min) *<input required type="number" min="1" step="1" value={form.preparationTimeMinutes} onChange={(e) => setForm({ ...form, preparationTimeMinutes: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Descripción *<textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ingredientes principales, acompañamientos…" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">URL de imagen (opcional)<input type="url" value={form.imageUrl || ""} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-700 sm:col-span-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-red-600" /> Publicar inmediatamente en el menú</label>
            </div>
            {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" disabled={saving} onClick={() => setEditingId(null)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">Cancelar</button><button type="submit" disabled={saving} className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{saving ? "Guardando…" : editingId === "new" ? "Crear producto" : "Guardar cambios"}</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
