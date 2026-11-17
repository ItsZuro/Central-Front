import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";

type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
type AvailableTable = { id: number; name: string; capacity: number; availableTimes: string[] };
type Reservation = {
  id: number; tableNumber: string; reservationDate: string; reservationTime: string;
  numberOfPeople: number; status: Status;
};
type Page<T> = { content: T[] };
const statusNames: Record<Status, string> = {
  PENDING: "Pendiente de confirmación",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
};
function limaDateTime(extraMinutes = 0) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(Date.now() + extraMinutes * 60_000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return { date: [get("year"), get("month"), get("day")].join("-"), time: get("hour") + ":" + get("minute") };
}
function getError(e: unknown) {
  if (axios.isAxiosError(e)) {
    const response = e.response?.data as { message?: string } | undefined;
    if (response?.message) return response.message;
    if (e.response?.status === 401) return "Inicia sesión nuevamente.";
    if (e.response?.status === 403) return "No tienes permisos para realizar esta operación.";
  }
  return "No se pudo completar la solicitud. Comprueba la conexión con el servidor.";
}

export default function Reservations() {
  const user = useAuthStore((s) => s.user);
  const isClient = Boolean(user?.roles?.includes("ROLE_CLIENT"));
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState(2);
  const [time, setTime] = useState("");
  const [tableId, setTableId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [availability, setAvailability] = useState<AvailableTable[]>([]);
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Reservation | null>(null);
  const [reload, setReload] = useState(0);
  const today = limaDateTime().date;
  const threshold = limaDateTime(16);
  const latestSlot = threshold.date + "T" + threshold.time;

  useEffect(() => {
    if (user) {
      setName((old) => old || user.fullName || "");
      setPhone((old) => old || user.phone || "");
    }
  }, [user]);

  useEffect(() => {
    setTime("");
    setTableId(null);
    setAvailability([]);
    setError("");
    if (!date || date < today) return;
    let active = true;
    setLoading(true);
    api.get<ApiResponse<AvailableTable[]>>("tables/available-times", {
      params: { numberOfPeople: guests, date, filterByCapacity: true },
    }).then(({ data }) => {
      if (active) setAvailability(data.data || []);
    }).catch((e: unknown) => {
      if (active) setError(getError(e));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [date, guests, reload, today]);

  useEffect(() => {
    if (!isClient) {
      setBookings([]);
      return;
    }
    let active = true;
    api.get<ApiResponse<Page<Reservation>>>("reservations/me", {
      params: { page: 0, size: 20 },
    }).then(({ data }) => {
      if (active) setBookings(data.data?.content || []);
    }).catch(() => {
      if (active) setBookings([]);
    });
    return () => { active = false; };
  }, [isClient, reload]);

  const slots = useMemo(() =>
    Array.from(new Set(availability.flatMap((t) => t.availableTimes || [])))
      .filter((v) => date + "T" + v >= latestSlot).sort(),
    [availability, date, latestSlot]
  );
  const tables = useMemo(() =>
    availability.filter((t) => t.availableTimes?.includes(time)),
    [availability, time]
  );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setCreated(null);
    if (!isClient) { setError("Necesitas una cuenta de cliente."); return; }
    if (!date || !time || !tableId || !tables.some((t) => t.id === tableId)) {
      setError("Elige una fecha, un horario y una mesa disponibles."); return;
    }
    if (!name.trim() || phone.trim().length < 7 || phone.trim().length > 15) {
      setError("Comprueba el nombre y el teléfono (7 a 15 caracteres)."); return;
    }
    setSending(true);
    try {
      const response = await api.post<Reservation>("reservations/me", {
        tableId, contactName: name.trim(), contactPhone: phone.trim(),
        reservationDate: date, reservationTime: time + ":00", numberOfPeople: guests,
      });
      setCreated(response.data);
      setReload((n) => n + 1);
    } catch (cause) {
      setError(getError(cause));
      setReload((n) => n + 1);
    } finally {
      setSending(false);
    }
  }

  async function cancel(id: number) {
    setError("");
    setCancelling(id);
    try {
      await api.patch("reservations/me/" + id + "/cancel");
      setReload((n) => n + 1);
    } catch (cause) {
      setError(getError(cause));
    } finally {
      setCancelling(null);
    }
  }

  const inputClass = "w-full rounded-lg border border-neutral-600 bg-neutral-800 p-3 text-white";
  return (
    <section className="min-h-screen bg-neutral-950 px-4 py-28 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-3 text-center text-4xl font-bold">Reserva tu mesa</h1>
        <p className="mb-9 text-center text-neutral-300">
          Elige un horario disponible. Las solicitudes quedan pendientes hasta que el restaurante las confirme.
        </p>
        {!isClient && (
          <div className="mb-6 rounded-lg border border-yellow-600 bg-yellow-950/30 p-5" role="status">
            Para solicitar una reserva necesitas iniciar sesión con una cuenta de cliente.{" "}
            <Link className="underline" to="/auth/login">Iniciar sesión</Link> ·{" "}
            <Link className="underline" to="/auth/signup">Crear cuenta</Link>
          </div>
        )}
        <form onSubmit={submit} className="rounded-2xl border border-neutral-700 bg-neutral-900 p-7">
          <div className="grid gap-5 md:grid-cols-2">
            <label>Fecha
              <input className={inputClass} type="date" required min={today} value={date}
                onChange={(e) => { setDate(e.target.value); setCreated(null); }} />
            </label>
            <label>Número de personas
              <select className={inputClass} value={guests}
                onChange={(e) => { setGuests(Number(e.target.value)); setCreated(null); }}>
                {Array.from({ length: 10 }, (_, i) => i + 1)
                  .map((v) => <option key={v} value={v}>{v} persona(s)</option>)}
              </select>
            </label>
            <label>Horario disponible
              <select className={inputClass} required value={time} disabled={!date || loading}
                onChange={(e) => { setTime(e.target.value); setTableId(null); setCreated(null); }}>
                <option value="">{loading ? "Consultando..." : "Seleccionar horario"}</option>
                {slots.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Mesa
              <select className={inputClass} required value={tableId ?? ""} disabled={!time}
                onChange={(e) => setTableId(Number(e.target.value) || null)}>
                <option value="">Seleccionar mesa</option>
                {tables.map((t) => <option key={t.id} value={t.id}>{t.name} · capacidad {t.capacity}</option>)}
              </select>
            </label>
            <label>Nombre de contacto
              <input className={inputClass} required value={name} maxLength={100}
                onChange={(e) => setName(e.target.value)} />
            </label>
            <label>Teléfono
              <input className={inputClass} required type="tel" minLength={7} maxLength={15}
                value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
          {date && !loading && !error && slots.length === 0 &&
            <p className="mt-4 text-yellow-300">No hay horarios disponibles para esa fecha y cantidad de personas.</p>}
          {error && <p className="mt-4 rounded-lg bg-red-950 p-3 text-red-200" role="alert">{error}</p>}
          {created && <p className="mt-4 rounded-lg bg-green-950 p-4 text-green-200" role="status">
            Solicitud #{created.id} registrada. Estado: {statusNames[created.status]}.
            La solicitud no implica confirmación automática.
          </p>}
          <button disabled={!isClient || !tableId || sending || loading} type="submit"
            className="mt-7 w-full rounded-lg bg-red-600 p-4 font-semibold hover:bg-red-700 disabled:opacity-50">
            {sending ? "Guardando..." : "Solicitar reserva"}
          </button>
          <p className="mt-3 text-center text-xs text-neutral-400">
            La disponibilidad se comprueba nuevamente al registrar la reserva.
          </p>
        </form>
        {isClient && (
          <div className="mt-8 rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <h2 className="mb-4 text-2xl font-semibold">Mis reservas recientes</h2>
            {bookings.length === 0 && <p className="text-neutral-300">No tienes reservas registradas.</p>}
            <ul className="space-y-3">
              {bookings.map((item) => <li key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-700 p-3">
                <span>#{item.id} · {item.reservationDate} {item.reservationTime.slice(0, 5)} ·
                  {item.numberOfPeople} personas · {statusNames[item.status]}</span>
                {(item.status === "PENDING" || item.status === "CONFIRMED") && (
                  <button type="button" disabled={cancelling === item.id}
                    onClick={() => void cancel(item.id)}
                    className="rounded border border-red-500 px-3 py-2 text-sm disabled:opacity-50">
                    {cancelling === item.id ? "Cancelando..." : "Cancelar"}
                  </button>
                )}
              </li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
