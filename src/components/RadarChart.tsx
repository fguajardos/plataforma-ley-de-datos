// Radar de madurez en SVG puro (sin dependencias).

type Punto = { label: string; value: number | null };

export function RadarChart({
  data,
  max = 5,
  size = 420,
}: {
  data: Punto[];
  max?: number;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 70;
  const n = data.length;
  if (n < 3) return null;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, r: number) => ({
    x: cx + Math.cos(angle(i)) * r,
    y: cy + Math.sin(angle(i)) * r,
  });

  // Anillos de fondo
  const rings = [1, 2, 3, 4, 5].map((lvl) => {
    const r = (radius * lvl) / max;
    const pts = data.map((_, i) => point(i, r));
    return pts.map((p) => `${p.x},${p.y}`).join(" ");
  });

  // Polígono de datos
  const dataPts = data.map((d, i) => point(i, (radius * (d.value ?? 0)) / max));
  const dataPoly = dataPts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-auto w-full max-w-md">
      {/* anillos */}
      {rings.map((r, i) => (
        <polygon key={i} points={r} fill="none" stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {/* ejes */}
      {data.map((_, i) => {
        const p = point(i, radius);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={1} />;
      })}
      {/* área de datos */}
      <polygon points={dataPoly} fill="#2563eb33" stroke="#2563eb" strokeWidth={2} />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#2563eb" />
      ))}
      {/* etiquetas */}
      {data.map((d, i) => {
        const p = point(i, radius + 22);
        const a = angle(i);
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-slate-500"
            fontSize={10}
          >
            {d.label.length > 18 ? d.label.slice(0, 17) + "…" : d.label}
          </text>
        );
      })}
    </svg>
  );
}
