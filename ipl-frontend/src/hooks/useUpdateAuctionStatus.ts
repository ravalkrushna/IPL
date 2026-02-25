/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { auctionApi } from "@/lib/auctionApi"

export function useUpdateAuctionStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: any) =>
      auctionApi.updateStatus(id, status),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeAuction"] })
    },
  })
}