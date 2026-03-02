import { auctionApi } from "@/lib/auctionApi"
import { useQuery } from "@tanstack/react-query"

export function useActiveAuctions() {
  return useQuery({
    queryKey: ["activeAuctions"],
    queryFn:  auctionApi.activeList,
    retry:    false,
  })
}