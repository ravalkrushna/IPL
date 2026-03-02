import { useQuery } from "@tanstack/react-query"
import { biddingApi } from "@/lib/biddingApi"

export function useWallet(participantId: string | undefined, auctionId: string | undefined) {
  return useQuery({
    queryKey: ["wallet", participantId, auctionId],
    queryFn:  () => biddingApi.getWallet(participantId!, auctionId!),
    enabled:  !!participantId && !!auctionId,
  })
}