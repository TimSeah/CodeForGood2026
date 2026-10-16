// Reference data (therapists, students) used across features.
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Student, Therapist } from "@/api/types";

export const useTherapists = () =>
  useQuery({ queryKey: ["therapists"], queryFn: () => api.get<Therapist[]>("/therapists") });

export const useStudents = () => useQuery({ queryKey: ["students"], queryFn: () => api.get<Student[]>("/students") });
