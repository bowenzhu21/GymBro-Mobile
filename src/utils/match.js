export const INVALID_IG = 'this-handle_is_invalid-and_too_long_0123456789';

export const sampleUsers = [
];

const scales = { height: 200, weight: 300, benchPress: 400, squat: 500 };
const asNumber = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function computeDistance(a, b, weights) {
  const keys = Object.keys(scales);
  let sum = 0;
  let used = 0;
  for (const k of keys) {
    const av = asNumber(a?.[k]);
    const bv = asNumber(b?.[k]);
    if (av !== undefined && bv !== undefined) {
      const d = (av - bv) / scales[k];
      const w = weights?.[k] ?? 1;
      sum += w * d * d;
      used += 1;
    }
  }
  if (used === 0) return Infinity;
  return Math.sqrt(sum / used);
}

export const percent = (distance) => Math.max(0, Math.min(100, Math.round(100 * (1 - distance))));
