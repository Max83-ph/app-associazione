import { useEffect, useRef } from 'react';

/** Riquadro in cui firmare con il dito o il mouse. Restituisce un PNG come data URL. */
export function Firma({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const disegnando = useRef(false);
  const vuota = useRef(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    c.width = width * ratio;
    c.height = height * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1D3557';
  }, []);

  const punto = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const inizia = (e: React.PointerEvent) => {
    canvas.current!.setPointerCapture(e.pointerId);
    disegnando.current = true;
    const ctx = canvas.current!.getContext('2d')!;
    const { x, y } = punto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const muovi = (e: React.PointerEvent) => {
    if (!disegnando.current) return;
    const ctx = canvas.current!.getContext('2d')!;
    const { x, y } = punto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    vuota.current = false;
  };

  const fine = () => {
    if (!disegnando.current) return;
    disegnando.current = false;
    if (!vuota.current) onChange(esporta(canvas.current!));
  };

  const cancella = () => {
    const c = canvas.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    vuota.current = true;
    onChange(null);
  };

  return (
    <div className="firma">
      <canvas
        ref={canvas}
        className="firma-area"
        aria-label="Area per la firma"
        onPointerDown={inizia}
        onPointerMove={muovi}
        onPointerUp={fine}
        onPointerCancel={fine}
      />
      <button type="button" className="link-bottone" onClick={cancella}>Cancella firma</button>
    </div>
  );
}

/** Ridimensiona la firma a 600px di larghezza per tenerla leggera nel database. */
function esporta(src: HTMLCanvasElement): string {
  const w = 600;
  const h = Math.round((src.height / src.width) * w);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  return out.toDataURL('image/png');
}
