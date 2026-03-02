import { useQuery } from "@tanstack/react-query"
import { dashboardApi } from "@/lib/dashboardApi"

export function useWalletLeaderboard(auctionId: string | undefined) {
  return useQuery({
    queryKey: ["leaderboard", auctionId],
    queryFn:  () => dashboardApi.leaderboard(auctionId!),
    enabled:  !!auctionId,
  })
}