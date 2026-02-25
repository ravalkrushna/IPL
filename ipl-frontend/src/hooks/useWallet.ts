import { useQuery } from "@tanstack/react-query"
import { biddingApi } from "@/lib/biddingApi"

export function useWallet(participantId?: string) {
  return useQuery({
    queryKey: ["wallet", participantId],
    queryFn: () => biddingApi.getWallet(participantId!),
    enabled: !!participantId,
  })
}