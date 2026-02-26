import { api } from "./api"

export const auctionEngineApi = {
  currentPlayer: async (auctionId: string) => {
  const res = await api.get(`/auction-engine/current-player/${auctionId}`)
  console.log("🏏 currentPlayer raw:", JSON.stringify(res.data))  // ADD THIS
  return res.data
}
}