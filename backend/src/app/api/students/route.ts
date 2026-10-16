import { handle, ok } from "@/lib/http";
import { listStudents } from "@/lib/repositories/students";

export const GET = handle(() => ok(listStudents()));
