// Endpoint del asistente virtual. Recibe el historial del chat, arma el system prompt
// (base de conocimiento + contexto agregado del diagnóstico) y transmite en streaming
// la respuesta de Gemini 2.5 Flash como texto plano.

import { getSession } from "@/lib/session";
import { CONOCIMIENTO_BASE } from "@/lib/chatbot/conocimiento";
import { contextoAgregado } from "@/lib/chatbot/contexto";

const MODELO = "gemini-2.5-flash";
const MAX_MENSAJES = 12; // últimos turnos que se envían al modelo
const MAX_CHARS_MENSAJE = 4000;

// Rate limit en memoria (por instancia). La capa gratuita de Gemini permite ~10 req/min
// por API key, compartida entre TODOS los usuarios: limitamos por usuario y global.
const ventanaUsuario = new Map<string, number[]>();
const ventanaGlobal: number[] = [];

function permitido(userId: string): boolean {
  const ahora = Date.now();
  const corte = ahora - 60_000;
  const propios = (ventanaUsuario.get(userId) ?? []).filter((t) => t > corte);
  while (ventanaGlobal.length && ventanaGlobal[0] <= corte) ventanaGlobal.shift();
  if (propios.length >= 4 || ventanaGlobal.length >= 9) return false;
  propios.push(ahora);
  ventanaUsuario.set(userId, propios);
  ventanaGlobal.push(ahora);
  return true;
}

type MensajeChat = { role: "user" | "assistant"; text: string };

const MSG_LIMITE =
  "Estoy recibiendo muchas consultas en este momento. Espera un minuto e inténtalo de nuevo.";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "Asistente no configurado" }, { status: 503 });
  }
  if (!permitido(session.user.id)) {
    return Response.json({ error: MSG_LIMITE }, { status: 429 });
  }

  let mensajes: MensajeChat[];
  try {
    const body = await request.json();
    mensajes = (body.messages as MensajeChat[])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
      .slice(-MAX_MENSAJES)
      .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_CHARS_MENSAJE) }));
    if (mensajes.length === 0 || mensajes[mensajes.length - 1].role !== "user") {
      throw new Error("historial inválido");
    }
  } catch {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const contexto = await contextoAgregado(session);
  const systemPrompt = `${CONOCIMIENTO_BASE}\n\n# Contexto del usuario actual\n\n${contexto}`;

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: mensajes.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        })),
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 429 ? 429 : 502;
    const error =
      upstream.status === 429
        ? MSG_LIMITE
        : "El asistente no está disponible en este momento. Inténtalo más tarde.";
    return Response.json({ error }, { status });
  }

  // Re-emite el SSE de Gemini como texto plano (solo los fragmentos de texto).
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lineas = buffer.split("\n");
      buffer = lineas.pop() ?? "";
      for (const linea of lineas) {
        if (!linea.startsWith("data: ")) continue;
        try {
          const json = JSON.parse(linea.slice(6));
          const texto = json.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text ?? "")
            .join("");
          if (texto) controller.enqueue(encoder.encode(texto));
        } catch {
          // línea parcial o keep-alive: se ignora
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
