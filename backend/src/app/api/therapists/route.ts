import { handle, ok } from "@/lib/http";
import { listTherapists } from "@/lib/repositories/therapists";

export const GET = handle(() => ok(listTherapists()));
