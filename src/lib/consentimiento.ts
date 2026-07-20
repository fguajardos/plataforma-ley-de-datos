// Texto del consentimiento informado que el usuario debe aceptar antes de usar
// la plataforma (Ley N° 21.719 sobre protección de datos personales).
//
// IMPORTANTE: al modificar el texto, incrementa CONSENTIMIENTO_VERSION. Los usuarios
// que aceptaron una versión anterior volverán a ver el gate automáticamente, y cada
// aceptación queda registrada por separado en AceptacionConsentimiento.

export const CONSENTIMIENTO_VERSION = "1.0";
export const CONSENTIMIENTO_VIGENCIA = "19 de julio de 2026";

/** Razón social y datos de contacto del responsable del tratamiento. */
export const RESPONSABLE = {
  nombre: "Procesos 360",
  razonSocial: "PROCESOS360 SpA",
  rut: "77.911.934-3",
};

// PENDIENTE (obligación legal): la Ley 21.719 exige informar un canal concreto para que
// el titular ejerza sus derechos. Mientras no exista una casilla dedicada, el texto deriva
// la solicitud al administrador de la plataforma en su organización y al equipo de
// Procesos 360 que la atiende. Al habilitar un correo formal, agrégalo aquí y en las
// secciones 7 y 8, y sube CONSENTIMIENTO_VERSION para que se vuelva a consentir.

export type SeccionConsentimiento = {
  titulo: string;
  parrafos?: string[];
  items?: string[];
};

export const SECCIONES: SeccionConsentimiento[] = [
  {
    titulo: "1. Quién trata sus datos",
    parrafos: [
      `${RESPONSABLE.razonSocial}, RUT ${RESPONSABLE.rut}, que opera bajo el nombre comercial ${RESPONSABLE.nombre}, actúa como responsable del tratamiento de los datos personales que usted entrega al utilizar esta plataforma.`,
      "Su empleador contrató esta plataforma para realizar el diagnóstico y plan de cumplimiento de la Ley N° 21.719 de su organización. Su cuenta de usuario fue creada en ese contexto.",
    ],
  },
  {
    titulo: "2. Qué datos tratamos",
    parrafos: ["Tratamos únicamente los datos necesarios para operar la plataforma:"],
    items: [
      "Datos de identificación: nombre completo y correo electrónico.",
      "Datos laborales: cargo, área y empresa a la que pertenece.",
      "Datos de acceso: contraseña almacenada de forma cifrada (nunca en texto plano) y rol asignado dentro de la plataforma.",
      "Datos de actividad: respuestas al diagnóstico, evidencias que cargue, y fecha y hora de las acciones que realice en el sistema.",
    ],
  },
  {
    titulo: "3. Para qué los usamos",
    parrafos: [
      "Procesos 360 trata sus datos de forma interna y exclusivamente para las siguientes finalidades:",
    ],
    items: [
      "Crear y administrar su cuenta, autenticar su identidad y controlar los permisos según su rol.",
      "Ejecutar el diagnóstico de cumplimiento y generar los informes, brechas, riesgos y planes de acción de su empresa.",
      "Mantener la trazabilidad de quién respondió, cargó o modificó cada antecedente, como respaldo del propio diagnóstico.",
      "Brindarle soporte técnico y comunicarle información operativa del servicio.",
    ],
  },
  {
    titulo: "4. Uso interno y no cesión a terceros",
    parrafos: [
      "Sus datos son de uso interno de Procesos 360 y del equipo asignado a su empresa. No los vendemos, no los arrendamos ni los cedemos a terceros con fines comerciales, publicitarios o de perfilamiento.",
      "Solo accede a ellos el personal de Procesos 360 que necesita hacerlo para prestar el servicio, sujeto a obligaciones de confidencialidad, y los proveedores tecnológicos estrictamente necesarios para operar la plataforma (alojamiento e infraestructura), quienes actúan como encargados del tratamiento bajo instrucción de Procesos 360 y no pueden usar los datos para fines propios.",
    ],
  },
  {
    titulo: "5. Seguridad y confidencialidad",
    parrafos: [
      "Aplicamos medidas técnicas y organizativas para proteger sus datos: cifrado de contraseñas, cifrado de las comunicaciones, control de acceso por rol, separación lógica de la información de cada empresa y almacenamiento de evidencias en repositorios privados.",
      "Si ocurriera una vulneración de seguridad que afecte sus datos, se lo comunicaremos y notificaremos a la Agencia de Protección de Datos Personales conforme a la ley.",
    ],
  },
  {
    titulo: "6. Por cuánto tiempo los conservamos",
    parrafos: [
      "Conservamos sus datos mientras su cuenta esté activa y mientras dure la relación contractual entre Procesos 360 y su empresa. Terminada esta, conservamos la información por el plazo necesario para atender obligaciones legales, contractuales y de respaldo del trabajo realizado, y luego procedemos a su eliminación o anonimización.", // TODO: fijar plazo concreto (p. ej. 5 años) según política de retención
    ],
  },
  {
    titulo: "7. Sus derechos",
    parrafos: [
      "La Ley N° 21.719 le reconoce los derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo respecto de sus datos personales.",
      "Para ejercerlos, diríjase al administrador de la plataforma en su organización, quien canalizará su solicitud al equipo de Procesos 360. Responderemos dentro de los plazos legales. Si considera que su solicitud no fue atendida correctamente, puede reclamar ante la Agencia de Protección de Datos Personales.",
    ],
  },
  {
    titulo: "8. Revocación del consentimiento",
    parrafos: [
      "Usted puede revocar este consentimiento en cualquier momento, sin efecto retroactivo, solicitándolo por la misma vía indicada en el punto anterior. Tenga presente que ciertos datos mínimos de identificación y acceso son indispensables para operar la plataforma, por lo que la revocación implicará la desactivación de su cuenta.",
    ],
  },
];

export const DECLARACION =
  "Declaro que he leído y comprendido esta información, y otorgo mi consentimiento libre, informado y específico para que Procesos 360 trate mis datos personales de forma interna, en los términos y para las finalidades aquí señaladas.";
