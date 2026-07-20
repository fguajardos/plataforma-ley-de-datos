"use client";

// Asistente virtual flotante. Mantiene el historial en sessionStorage (sobrevive a la
// navegación, se pierde al cerrar la pestaña) y recibe la respuesta en streaming.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Mensaje = { role: "user" | "assistant"; text: string };

const STORAGE_KEY = "p360-chat";
const SALUDO: Mensaje = {
  role: "assistant",
  text: "Hola, soy el asistente de Procesos360. Puedo ayudarte con dudas sobre la Ley 21.719, el uso de la plataforma o los resultados de tu diagnóstico. ¿En qué te ayudo?",
};

/** Render mínimo: negritas **texto**, viñetas "- " y saltos de línea. */
function Texto({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linea, i) => {
        const esViñeta = linea.startsWith("- ") || linea.startsWith("* ");
        const contenido = esViñeta ? linea.slice(2) : linea;
        const partes = contenido.split(/\*\*(.+?)\*\*/g);
        const nodos = partes.map((p, j) => (j % 2 === 1 ? <strong key={j}>{p}</strong> : p));
        return esViñeta ? (
          <span key={i} className="block pl-3">
            • {nodos}
          </span>
        ) : (
          <span key={i} className="block min-h-[0.5rem]">
            {nodos}
          </span>
        );
      })}
    </>
  );
}

export function ChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([SALUDO]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(STORAGE_KEY);
      if (guardado) setMensajes(JSON.parse(guardado));
    } catch {
      // historial corrupto: se parte de cero
    }
  }, []);

  useEffect(() => {
    if (mensajes.length > 1) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mensajes));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [mensajes, abierto]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || enviando) return;
    setInput("");
    setEnviando(true);

    const historial: Mensaje[] = [...mensajes, { role: "user", text: texto }];
    setMensajes([...historial, { role: "assistant", text: "" }]);

    const actualizarUltimo = (t: string) =>
      setMensajes([...historial, { role: "assistant", text: t }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El saludo inicial no aporta: se envían solo los turnos reales.
        body: JSON.stringify({ messages: historial.filter((m) => m !== SALUDO) }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        actualizarUltimo(data?.error ?? "Ocurrió un error. Inténtalo de nuevo.");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acumulado = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acumulado += decoder.decode(value, { stream: true });
        actualizarUltimo(acumulado);
      }
      if (!acumulado) actualizarUltimo("No obtuve respuesta. Inténtalo de nuevo.");
    } catch {
      actualizarUltimo("Error de conexión. Revisa tu red e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {/* Panel */}
      {abierto && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Asistente Procesos360</p>
              <p className="text-xs text-white/70">Ley 21.719 · uso de la plataforma</p>
            </div>
            <button
              onClick={() => {
                setMensajes([SALUDO]);
                sessionStorage.removeItem(STORAGE_KEY);
              }}
              className="rounded-lg px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              title="Nueva conversación"
            >
              Limpiar
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {mensajes.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto rounded-br-sm bg-brand-600 text-white"
                    : "rounded-bl-sm bg-slate-100 text-slate-800"
                )}
              >
                {m.text ? (
                  <Texto texto={m.text} />
                ) : (
                  <span className="animate-pulse text-slate-400">Escribiendo…</span>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                rows={1}
                placeholder="Escribe tu pregunta…"
                className="max-h-24 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
              />
              <button
                onClick={enviar}
                disabled={enviando || !input.trim()}
                className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">
              Respuestas orientativas generadas con IA: valida lo importante con tu consultor.
            </p>
          </div>
        </div>
      )}

      {/* Burbuja */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-transform hover:scale-105"
        title={abierto ? "Cerrar asistente" : "Abrir asistente"}
      >
        {abierto ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h8m-8 4h5m-9 6V7a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 3z"
            />
          </svg>
        )}
      </button>
    </>
  );
}
