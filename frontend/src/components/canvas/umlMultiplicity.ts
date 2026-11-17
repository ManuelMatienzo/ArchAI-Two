export function isValidUmlMultiplicity(value: string): boolean {
  if (value === '' || value === '*') return true;
  if (/^\d+$/.test(value)) return true;
  const range = /^(\d+)\.\.(\d+|\*)$/.exec(value);
  return !!range && (range[2] === '*' || Number(range[1]) <= Number(range[2]));
}
