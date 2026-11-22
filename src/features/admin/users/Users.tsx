import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import axios from "axios";
import { CircleUserRound, Pencil, Plus, Search, ShieldCheck, UserRoundCheck, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  provider: string;
  enabled: boolean;
  roles: string[];
}

interface UserForm {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  enabled: boolean;
}

function errorText(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || "No se pudo guardar el usuario.";
  return "Ocurrió un error inesperado.";
}

export default function Users() {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "", email: "", firstName: "", lastName: "", phone: "",
    password: "", role: "ROLE_WAITER",
  });
  const [form, setForm] = useState<UserForm>({
    username: "", email: "", firstName: "", lastName: "", phone: "", enabled: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("users/admin");
      setUsers(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => users.filter((user) =>
    [user.username, user.email, user.firstName, user.lastName].join(" ").toLowerCase().includes(query.trim().toLowerCase())
  ), [users, query]);

  const openEdit = (user: AdminUser) => {
    setError("");
    setEditing(user);
    setForm({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || "",
      enabled: user.enabled,
    });
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if (!form.username.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) return setError("Completa todos los campos obligatorios.");
    if (editing.id === currentUserId && !form.enabled) return setError("No puedes desactivar tu propia cuenta desde este panel.");
    setSaving(true);
    setError("");
    setNotice("");
    try {
      // Omitimos roles: el endpoint actual puede actualizar los datos básicos sin alterar permisos.
      // NO enviamos roles nuevos porque la implementación actual del backend requiere corregir esa operación.
      await api.put("users/" + editing.id, {
        username: form.username.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        enabled: form.enabled,
      });
      setEditing(null);
      setNotice("Usuario actualizado correctamente.");
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const createStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newUser.password.length < 12) return setError("La contraseña inicial debe tener por lo menos 12 caracteres.");
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.post("users/admin", {
        ...newUser,
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        firstName: newUser.firstName.trim(),
        lastName: newUser.lastName.trim(),
        phone: newUser.phone.trim() || null,
      });
      setCreating(false);
      setNewUser({ username: "", email: "", firstName: "", lastName: "", phone: "", password: "", role: "ROLE_WAITER" });
      setNotice("Cuenta creada correctamente. Ya puede iniciar sesión con sus credenciales.");
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-red-600">Equipo · Administración</p><h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Usuarios</h1><p className="mt-2 text-sm text-slate-500">Crea cuentas de personal y administra las existentes desde un solo lugar.</p></div>
        <button type="button" onClick={() => { setError(""); setCreating(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700"><Plus size={18} /> Nuevo usuario</button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total de cuentas", value: users.length, icon: UsersRound },
          { label: "Cuentas activas", value: users.filter((user) => user.enabled).length, icon: UserRoundCheck },
          { label: "Administradores", value: users.filter((user) => user.roles?.includes("ROLE_ADMIN")).length, icon: ShieldCheck },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="rounded-xl bg-red-50 p-3 text-red-600"><item.icon size={22} /></span>
            <div><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{loading ? "…" : item.value}</p></div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-slate-900">Directorio de usuarios</h2><p className="mt-1 text-xs text-slate-500">Gestiona la información y el estado de las cuentas.</p></div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-slate-400"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar usuarios" placeholder="Buscar usuarios…" className="w-full bg-transparent py-2.5 text-sm text-slate-800 outline-none sm:w-56" /></label>
        </div>

        {loading ? <p className="p-12 text-center text-sm text-slate-500">Cargando usuarios…</p> : !filtered.length ? (
          <div className="flex flex-col items-center p-16 text-center"><div className="rounded-2xl bg-red-50 p-5 text-red-600"><UsersRound size={30} /></div><p className="mt-5 font-bold text-slate-900">No se encontraron usuarios</p><p className="mt-2 text-sm text-slate-500">Prueba otro término de búsqueda.</p></div>
        ) : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-4">Usuario</th><th className="px-6 py-4">Correo</th><th className="px-6 py-4">Roles</th><th className="px-6 py-4">Proveedor</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Acciones</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filtered.map((user) => <tr key={user.id} className="hover:bg-slate-50/70">
            <td className="whitespace-nowrap px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700"><CircleUserRound size={19} /></span><div><p className="font-semibold text-slate-900">{user.firstName} {user.lastName}</p><p className="text-xs text-slate-500">@{user.username}</p></div></div></td>
            <td className="px-6 py-4 text-slate-600">{user.email}</td>
            <td className="px-6 py-4"><div className="flex flex-wrap gap-1">{user.roles?.length ? user.roles.map((role) => <span key={role} className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">{role.replace("ROLE_", "")}</span>) : <span className="text-slate-400">—</span>}</div></td>
            <td className="px-6 py-4 text-slate-500">{user.provider || "—"}</td>
            <td className="px-6 py-4"><span className={user.enabled ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"}>{user.enabled ? "Activo" : "Inactivo"}</span></td>
            <td className="px-6 py-4 text-right"><button aria-label={"Editar " + user.username} onClick={() => openEdit(user)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-red-200 hover:text-red-700"><Pencil size={14} /> Editar</button></td>
          </tr>)}</tbody>
        </table></div>}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">Las cuentas nuevas se crean con un único rol de personal y una contraseña inicial segura. La creación requiere desplegar la nueva versión del backend antes que este frontend.</div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setCreating(false); }} role="presentation">
          <form onSubmit={(event) => void createStaff(event)} role="dialog" aria-modal="true" aria-label="Crear usuario" className="w-full max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-red-600">Personal</p><h2 className="mt-2 text-2xl font-bold text-slate-900">Nuevo usuario</h2></div><button type="button" aria-label="Cerrar" onClick={() => setCreating(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Usuario *<input required maxLength={30} autoComplete="off" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="text-sm font-semibold text-slate-700">Correo *<input required type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="text-sm font-semibold text-slate-700">Nombre *<input required value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="text-sm font-semibold text-slate-700">Apellido *<input required value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="text-sm font-semibold text-slate-700">Rol *<select required value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none focus:border-red-500"><option value="ROLE_WAITER">Mesero</option><option value="ROLE_CHEF">Cocinero</option><option value="ROLE_CASHIER">Cajero</option><option value="ROLE_MANAGER">Gerente</option><option value="ROLE_ADMIN">Administrador</option></select></label>
              <label className="text-sm font-semibold text-slate-700">Teléfono<input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Contraseña inicial (mínimo 12 caracteres) *<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" disabled={saving} onClick={() => setCreating(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">Cancelar</button><button type="submit" disabled={saving} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{saving ? "Guardando…" : "Crear cuenta"}</button></div>
          </form>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null); }} role="presentation">
          <form onSubmit={(event) => void save(event)} role="dialog" aria-modal="true" aria-label="Editar usuario" className="w-full max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-red-600">Administración</p><h2 className="mt-2 text-2xl font-bold text-slate-900">Editar usuario</h2></div><button aria-label="Cerrar" type="button" onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Usuario *<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="text-sm font-semibold text-slate-700">Correo *<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="text-sm font-semibold text-slate-700">Nombre *<input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="text-sm font-semibold text-slate-700">Apellido *<input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Teléfono<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-700 sm:col-span-2"><input type="checkbox" checked={form.enabled} disabled={editing.id === currentUserId} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="accent-red-600" /> Cuenta activa {editing.id === currentUserId && <span className="text-xs font-normal text-slate-500">(no puedes desactivar tu propia cuenta)</span>}</label>
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" disabled={saving} onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">Cancelar</button><button type="submit" disabled={saving} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{saving ? "Guardando…" : "Guardar cambios"}</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
