import { useMutation, useQueryClient } from "@tanstack/react-query"
import { auctionApi } from "@/lib/auctionApi"

export function useCreateAuction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: auctionApi.createAuction,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeAuction"] })
      queryClient.invalidateQueries({ queryKey: ["auctions"] })
    },
  })
}