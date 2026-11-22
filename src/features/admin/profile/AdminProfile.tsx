import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";
import type { UserResponse } from "@/core/types/user/user.model";
import axios from "axios";
import { ArrowLeft, CircleCheck, KeyRound, LockKeyhole, Mail, Save, ShieldCheck, UserRound, UserRoundPen } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";

interface ProfileForm {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const errorMessage = (error: unknown): string =>
  axios.isAxiosError<{message?: string}>(error)
    ? error.response?.data?.message || "El servidor no pudo guardar los cambios."
    : error instanceof Error ? error.message : "Ha ocurrido un error.";

export default function AdminProfile() {
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const accessToken = useAuthStore((state) => state.accessToken);
  const sessionId = useAuthStore((state) => state.sessionId);
  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileForm>({
    username: "", firstName: "", lastName: "", email: "", phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirm: "" });

  useEffect(() => {
    if (!user) return;
    setForm({
      username: user.username || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
    });
  }, [user]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (!form.username.trim() || !form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Completa los campos obligatorios."); return;
    }
    setSaving(true);
    try {
      const result = await api.put<ApiResponse<{user: UserResponse; token: string | null}>>("users/update-profile", {
        username: form.username.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      });
      const updated = result.data?.data;
      if (!result.data.success || !updated?.user) throw new Error(result.data.message || "No se pudo actualizar el perfil.");
      setAuth({
        user: updated.user,
        accessToken: updated.token || accessToken || "",
        sessionId: sessionId || "",
      });
      toast.success("Tu perfil administrativo se actualizó.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.newPassword.length < 12) {
      toast.error("La contraseña nueva debe tener al menos 12 caracteres."); return;
    }
    if (password.newPassword !== password.confirm) {
      toast.error("Las contraseñas nuevas no coinciden."); return;
    }
    setChangingPassword(true);
    try {
      await api.put("users/change-password", {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success("Contraseña actualizada. Vuelve a iniciar sesión.");
      useAuthStore.getState().logout();
      navigate("/auth/login", { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return <p className="p-6 text-sm text-slate-500">Cargando cuenta…</p>;
  const initials = (user.firstName?.[0] || user.username?.[0] || "A").toUpperCase() +
    (user.lastName?.[0] || "").toUpperCase();

  return (
    <section className="mx-auto max-w-6xl space-y-7">
      <div>
        <Link to="/admin/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-600"><ArrowLeft size={17}/> Volver al resumen</Link>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.19em] text-red-600">Mi cuenta · Administración</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Mi perfil</h1>
        <p className="mt-2 text-sm text-slate-500">Actualiza tus datos personales y gestiona la seguridad de tu acceso.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[310px_1fr]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="h-24 bg-gradient-to-r from-red-700 via-red-600 to-orange-500"/>
            <div className="relative px-6 pb-6 text-center">
              <div className="-mt-10 mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-red-50 text-2xl font-black text-red-700 shadow-md">
                {user.profileImageUrl ? <img src={user.profileImageUrl} alt="Foto de perfil" className="h-full w-full object-cover"/> : initials}
              </div>
              <h2 className="mt-4 text-lg font-extrabold text-slate-900">{user.fullName || user.username}</h2>
              <p className="mt-1 text-sm text-slate-500">@{user.username}</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"><ShieldCheck size={15}/> Administrador</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold text-slate-900"><CircleCheck size={18} className="text-emerald-600"/> Estado de la cuenta</h3>
            <p className="mt-3 text-sm text-slate-500">{user.enabled ? "Tu cuenta se encuentra activa." : "Tu cuenta está deshabilitada."}</p>
            <p className="mt-3 break-words text-sm text-slate-500"><Mail size={15} className="mr-2 inline"/> {user.email}</p>
          </div>
        </div>

        <div className="space-y-6">
          <form onSubmit={(event) => void saveProfile(event)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><UserRoundPen size={20} className="text-red-600"/> Información personal</h2>
              <p className="mt-1 text-xs text-slate-500">El nombre de usuario y el correo pueden estar sujetos a periodos mínimos entre cambios.</p>
            </div>
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              {([
                ["firstName","Nombre"],["lastName","Apellidos"],["username","Usuario"],["email","Correo electrónico"],["phone","Teléfono (opcional)"],
              ] as const).map(([key,label]) => (
                <label key={key} className={key === "phone" ? "text-sm font-semibold text-slate-700 sm:col-span-2" : "text-sm font-semibold text-slate-700"}>
                  {label} {key !== "phone" && "*"}
                  <div className="relative mt-2">
                    {(key === "username" || key === "firstName") && <UserRound size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />}
                    <input type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                      required={key !== "phone"} maxLength={key === "username" ? 30 : key === "email" ? 100 : 50}
                      value={form[key]} onChange={(event) => setForm((current) => ({...current,[key]:event.target.value}))}
                      className={"w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 text-sm font-normal text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-50 " + ((key === "username" || key === "firstName") ? "pl-10" : "pl-4")}/>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end border-t border-slate-100 px-6 py-4">
              <button disabled={saving} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"><Save size={17}/>{saving ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </form>

          <form onSubmit={(event) => void savePassword(event)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><LockKeyhole size={20} className="text-red-600"/> Seguridad de la cuenta</h2>
              <p className="mt-1 text-xs text-slate-500">Cambiar tu contraseña cerrará las sesiones anteriores y requerirá iniciar sesión de nuevo.</p>
            </div>
            <div className="space-y-4 p-6">
              {([
                ["currentPassword","Contraseña actual"],["newPassword","Nueva contraseña"],["confirm","Confirmar nueva contraseña"],
              ] as const).map(([key,label]) => (
                <label key={key} className="block text-sm font-semibold text-slate-700">{label}
                  <input type="password" autoComplete={key === "currentPassword" ? "current-password" : "new-password"}
                    minLength={key === "newPassword" || key === "confirm" ? 12 : undefined} required
                    value={password[key]} onChange={(event) => setPassword((current) => ({...current,[key]:event.target.value}))}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-red-500 focus:ring-2 focus:ring-red-50"/>
                </label>
              ))}
            </div>
            <div className="flex justify-end border-t border-slate-100 px-6 py-4">
              <button disabled={changingPassword} type="submit" className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-6 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"><KeyRound size={17}/>{changingPassword ? "Actualizando…" : "Cambiar contraseña"}</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
