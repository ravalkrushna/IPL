import { useQuery } from "@tanstack/react-query"
import { biddingApi } from "@/lib/biddingApi"

export function useWalletLeaderboard() {
  return useQuery({
    queryKey: ["walletLeaderboard"],
    queryFn: biddingApi.leaderboard,
  })
}