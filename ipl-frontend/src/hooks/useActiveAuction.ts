import { auctionApi } from "@/lib/auctionApi"
import { useQuery } from "@tanstack/react-query"

export const useActiveAuction = () =>
  useQuery({
    queryKey: ["activeAuction"],
    queryFn: auctionApi.active,
    retry: false, // important (active may not exist)
  })