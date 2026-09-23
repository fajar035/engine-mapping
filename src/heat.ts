// Skala warna panas untuk latar sel map
export function heat(value: number, min: number, max: number): string {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  const clamped = Math.min(Math.max(t, 0), 1);
  const hue = 210 - clamped * 170; // biru -> jingga/merah
  return `hsla(${Math.round(hue)}, 75%, 50%, 0.30)`;
}

export function heatInv(value: number, min: number, max: number): string {
  // variasi untuk nilai yang lebih tinggi = lebih "dingin" (misal fuel correction tinggi = kaya)
  return heat(max - value + min, min, max);
}