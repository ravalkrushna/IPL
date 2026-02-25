import { useQuery } from "@tanstack/react-query"
import { auctionApi } from "@/lib/auctionApi"

export function useAuctions() {
  return useQuery({
    queryKey: ["auctions"],
    queryFn: auctionApi.list,
  })
}