// Approximate centroids (lat, lng) of Singapore areas used in the case data. Good enough to rank
// "who lives closer" — not for travel-time estimates. Add areas here as new data arrives.
const AREAS: Record<string, [number, number]> = {
  "ang mo kio": [1.3691, 103.8454],
  bedok: [1.3236, 103.9273],
  bishan: [1.3508, 103.8485],
  "bukit batok": [1.359, 103.7637],
  "bukit panjang": [1.3774, 103.7719],
  "bukit timah": [1.3294, 103.8021],
  chinatown: [1.2836, 103.8443],
  "choa chu kang": [1.384, 103.747],
  clementi: [1.3151, 103.7652],
  "dhoby ghaut": [1.299, 103.8455],
  geylang: [1.3201, 103.8918],
  havelock: [1.2886, 103.8335],
  hougang: [1.3612, 103.8863],
  "jurong west": [1.3404, 103.709],
  kembangan: [1.321, 103.913],
  khatib: [1.4174, 103.8329],
  "lorong chuan": [1.3517, 103.864],
  "marine parade": [1.302, 103.9071],
  "pasir ris": [1.3721, 103.9474],
  punggol: [1.4043, 103.902],
  queenstown: [1.2942, 103.7861],
  sembawang: [1.4491, 103.8185],
  sengkang: [1.3868, 103.8914],
  serangoon: [1.3554, 103.8679],
  stevens: [1.32, 103.826],
  tampines: [1.3496, 103.9568],
  "tan kah kee": [1.326, 103.8075],
  "teck whye": [1.38, 103.753],
  "toa payoh": [1.3343, 103.8563],
  woodlands: [1.4382, 103.789],
  yishun: [1.4304, 103.8354],
};
const ALIASES: Record<string, string> = { cck: "choa chu kang", amk: "ang mo kio" };

/** "CCK / Khatib" → coordinates of the first recognised part. */
export function areaCoords(area: string | null | undefined): [number, number] | null {
  if (!area) return null;
  for (const raw of area.split("/")) {
    const key = raw.trim().toLowerCase();
    const hit = AREAS[ALIASES[key] ?? key];
    if (hit) return hit;
  }
  return null;
}

/** Straight-line distance in km between two areas, or null if either is unknown. */
export function distanceKm(a: string | null | undefined, b: string | null | undefined): number | null {
  const p = areaCoords(a);
  const q = areaCoords(b);
  if (!p || !q) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(q[0] - p[0]);
  const dLng = rad(q[1] - p[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p[0])) * Math.cos(rad(q[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10;
}
