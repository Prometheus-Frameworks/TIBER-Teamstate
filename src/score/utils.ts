export const clamp = (value: number, min = 0, max = 100): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export const safeNumber = (value: number | undefined, fallback = 0): number =>
  Number.isFinite(value) ? (value as number) : fallback;

export const normalize = (
  value: number,
  min: number,
  max: number,
  inverse = false
): number => {
  if (!Number.isFinite(value) || min === max) return 0;
  const ratio = clamp(((value - min) / (max - min)) * 100, 0, 100);
  return inverse ? 100 - ratio : ratio;
};

export const weightedAverage = (components: Record<string, number>, weights: Record<string, number>): number => {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight <= 0) return 0;

  const weightedSum = entries.reduce((sum, [key, weight]) => {
    const value = safeNumber(components[key], 0);
    return sum + value * weight;
  }, 0);

  return clamp(weightedSum / totalWeight, 0, 100);
};
