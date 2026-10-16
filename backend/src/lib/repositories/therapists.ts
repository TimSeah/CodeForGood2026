import { getDb } from "@/lib/db/client";
import type { Rank, Therapist } from "@/lib/types";

interface TherapistRow {
  id: number;
  name: string;
  rank: Rank;
  is_part_time: number;
  home_area: string | null;
}

const toTherapist = (r: TherapistRow): Therapist => ({
  id: r.id,
  name: r.name,
  rank: r.rank,
  isPartTime: r.is_part_time === 1,
  homeArea: r.home_area,
});

export function listTherapists(): Therapist[] {
  const rows = getDb().prepare("SELECT * FROM therapists ORDER BY name").all() as TherapistRow[];
  return rows.map(toTherapist);
}

export function getTherapist(id: number): Therapist | null {
  const row = getDb().prepare("SELECT * FROM therapists WHERE id = ?").get(id) as TherapistRow | undefined;
  return row ? toTherapist(row) : null;
}
