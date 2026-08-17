// Sin "server-only": este modulo lo comparten la aplicacion y los scripts de
// linea de comandos, y ese marcador solo resuelve dentro de Next. Igual queda del
// lado del servidor por construccion, porque importa el cliente de base de datos.
import { prisma } from "@/lib/db";
import { respuestaCompleta } from "@/lib/constants";

// Qué le falta a cada participante. Vive aquí y no en la página ni en el script de
// correos porque ambos deben decir exactamente lo mismo: si el panel dice que a
// alguien le faltan 12 preguntas, el recordatorio que le llega tiene que decir 12.

const BLOQUEADOS = ["EN_VALIDACION", "COMPLETADO"];

export type PendienteDominio = {
  orden: number;
  nombre: string;
  total: number;
  sinResponder: number; // nadie las ha respondido todavía
  sinTuMirada: number; // otro las respondió, esta persona aún no
  listoSinEnviar: boolean; // completo, solo falta mandarlo a validación
};

export type PendientesUsuario = {
  userId: string;
  nombre: string;
  email: string;
  cargo: string | null;
  dominios: PendienteDominio[];
  totalPreguntas: number; // sinResponder + sinTuMirada, sumado
  aportes: number; // cuánto ha respondido en total
  ultimaActividad: Date | null;
  ultimoRecordatorio: Date | null;
  alDia: boolean; // sin nada pendiente
};

/** Estado de todos los participantes de un diagnóstico. */
export async function pendientesDelDiagnostico(diagnosticoId: string): Promise<PendientesUsuario[]> {
  const dds = await prisma.diagnosticoDominio.findMany({
    where: { diagnosticoId, incluido: true },
    select: {
      estado: true,
      dominio: { select: { orden: true, nombre: true } },
      participantes: {
        select: {
          user: {
            select: {
              id: true, nombre: true, email: true, cargo: true, ultimoRecordatorio: true,
            },
          },
        },
      },
      respuestas: {
        select: {
          valor: true,
          comentario: true,
          pregunta: { select: { evidenciaObligatoria: true } },
          evidencias: { select: { archivoPath: true } },
          aportes: { select: { userId: true, updatedAt: true } },
        },
      },
    },
    orderBy: { dominio: { orden: "asc" } },
  });

  const porUsuario = new Map<string, PendientesUsuario>();

  for (const dd of dds) {
    const total = dd.respuestas.length;
    const bloqueado = BLOQUEADOS.includes(dd.estado);
    const completas = dd.respuestas.filter((r) =>
      respuestaCompleta({
        valor: r.valor,
        comentario: r.comentario,
        evidenciaObligatoria: r.pregunta.evidenciaObligatoria,
        tieneEvidencia: r.evidencias.some((e) => e.archivoPath),
      })
    ).length;

    for (const p of dd.participantes) {
      const u = p.user;
      let acc = porUsuario.get(u.id);
      if (!acc) {
        acc = {
          userId: u.id, nombre: u.nombre, email: u.email, cargo: u.cargo,
          dominios: [], totalPreguntas: 0, aportes: 0,
          ultimaActividad: null, ultimoRecordatorio: u.ultimoRecordatorio, alDia: true,
        };
        porUsuario.set(u.id, acc);
      }

      // Actividad y volumen de aporte se cuentan siempre, incluso en dominios cerrados.
      for (const r of dd.respuestas) {
        for (const a of r.aportes) {
          if (a.userId !== u.id) continue;
          acc.aportes++;
          if (!acc.ultimaActividad || a.updatedAt > acc.ultimaActividad) acc.ultimaActividad = a.updatedAt;
        }
      }

      if (bloqueado) continue; // ya enviado: no hay nada que pedirle

      const sinResponder = dd.respuestas.filter((r) => r.valor == null).length;
      const sinTuMirada = dd.respuestas.filter(
        (r) => r.valor != null && !r.aportes.some((a) => a.userId === u.id)
      ).length;
      const listoSinEnviar = total > 0 && completas === total;
      if (sinResponder === 0 && sinTuMirada === 0 && !listoSinEnviar) continue;

      acc.dominios.push({
        orden: dd.dominio.orden, nombre: dd.dominio.nombre, total,
        sinResponder, sinTuMirada, listoSinEnviar,
      });
      acc.totalPreguntas += sinResponder + sinTuMirada;
      acc.alDia = false;
    }
  }

  return [...porUsuario.values()].sort((a, b) => {
    // Primero quien más debe, y entre iguales quien nunca ha entrado.
    if (b.totalPreguntas !== a.totalPreguntas) return b.totalPreguntas - a.totalPreguntas;
    if (!a.ultimaActividad && b.ultimaActividad) return -1;
    if (a.ultimaActividad && !b.ultimaActividad) return 1;
    return a.nombre.localeCompare(b.nombre);
  });
}

/** Lo mismo, para una sola persona. */
export async function pendientesDeUsuario(
  diagnosticoId: string,
  userId: string
): Promise<PendientesUsuario | null> {
  const todos = await pendientesDelDiagnostico(diagnosticoId);
  return todos.find((u) => u.userId === userId) ?? null;
}

/** Frase corta de lo que falta en un dominio. La comparten el panel y el correo. */
export function queFalta(d: PendienteDominio): string {
  const partes: string[] = [];
  if (d.sinResponder > 0) partes.push(`${d.sinResponder} por responder`);
  if (d.sinTuMirada > 0) partes.push(`${d.sinTuMirada} sin tu mirada`);
  if (d.listoSinEnviar) partes.push("falta enviarlo");
  return partes.join(" · ");
}
