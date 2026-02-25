import { z } from "zod"

export const createAuctionSchema = z.object({
  name: z.string().min(3, "Auction name is too short"),
})

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>