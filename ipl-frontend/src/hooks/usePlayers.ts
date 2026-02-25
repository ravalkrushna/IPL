/* eslint-disable @typescript-eslint/no-explicit-any */
import { playerApi } from "@/lib/playerApi"
import { useQuery } from "@tanstack/react-query"

export const usePlayers = (filters: any) =>
  useQuery({
    queryKey: ["players", filters],
    queryFn: () => playerApi.list(filters),

    // ✅ TanStack Query v5
    placeholderData: (prev) => prev,
  })