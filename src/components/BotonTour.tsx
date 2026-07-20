"use client";

// Relanza el tutorial inicial cuando el usuario quiera repasarlo.

export function BotonTour() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("p360:abrir-tour"))}
      className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M9.6 9.2a2.5 2.5 0 114 2.3c-.9.6-1.6 1-1.6 2.1" />
        <path strokeLinecap="round" d="M12 17h.01" />
      </svg>
      Ver tutorial
    </button>
  );
}
