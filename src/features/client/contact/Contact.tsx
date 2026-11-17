import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";

export default function Contact() {
  const user = useAuthStore((s) => s.user);
  const canSubmit = Boolean(user?.roles?.includes("ROLE_CLIENT"));
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setReceipt(null);
    if (!canSubmit) { setError("Debes iniciar sesión con una cuenta de cliente."); return; }
    setSending(true);
    try {
      const response = await api.post<ApiResponse<number>>("contact", {
        subject: subject.trim(), message: message.trim(),
      });
      if (!response.data.success) throw new Error(response.data.message);
      setReceipt(response.data.data);
      setSubject("");
      setMessage("");
    } catch (e) {
      if (axios.isAxiosError(e)) {
        setError(e.response?.data?.message || "No se pudo registrar el mensaje.");
      } else {
        setError(e instanceof Error ? e.message : "No se pudo registrar el mensaje.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="min-h-screen bg-neutral-950 px-5 py-28 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-center text-4xl font-bold">Contáctanos</h1>
        <p className="mb-9 text-center text-neutral-300">
          Registra una consulta para que el equipo del restaurante pueda revisarla.
          Este formulario no envía un correo electrónico.
        </p>
        {!canSubmit && (
          <div className="mb-5 rounded-lg border border-yellow-500/50 bg-yellow-950/30 p-4">
            Para enviar una consulta, <Link to="/auth/login" className="underline">inicia sesión</Link>
            {" o "}
            <Link to="/auth/signup" className="underline">crea una cuenta</Link>.
          </div>
        )}
        <form onSubmit={submit} className="space-y-6 rounded-2xl border border-neutral-700 bg-neutral-900 p-7">
          <label className="block">Cuenta
            <input className="mt-2 w-full rounded-lg border border-neutral-600 bg-neutral-800 p-3"
              readOnly value={user?.email || "Inicia sesión para enviar una consulta"} />
          </label>
          <label className="block">Asunto
            <input className="mt-2 w-full rounded-lg border border-neutral-600 bg-neutral-800 p-3"
              required minLength={3} maxLength={120} value={subject}
              onChange={(e) => setSubject(e.target.value)} placeholder="¿En qué podemos ayudarte?" />
          </label>
          <label className="block">Mensaje
            <textarea className="mt-2 w-full rounded-lg border border-neutral-600 bg-neutral-800 p-3"
              required minLength={5} maxLength={3000} rows={6}
              value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe tu consulta" />
          </label>
          {error && <p className="rounded-lg bg-red-950 p-3 text-red-200" role="alert">{error}</p>}
          {receipt !== null && (
            <p className="rounded-lg bg-green-950 p-4 text-green-200" role="status">
              Tu mensaje fue guardado para revisión con el número #{receipt}.
            </p>
          )}
          <button type="submit" disabled={!canSubmit || sending}
            className="w-full rounded-xl bg-red-600 p-4 font-semibold hover:bg-red-700 disabled:opacity-50">
            {sending ? "Registrando..." : "Registrar mensaje"}
          </button>
        </form>
      </div>
    </section>
  );
}
