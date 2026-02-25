import { api } from "./api"

export const biddingApi = {

  placeBid: async (data: {
    auctionId: string
    playerId: string
    participantId: string
    amount: number
  }) => {
    const res = await api.post("/bidding/place", data)
    return res.data
  },

  getWallet: async (participantId: string) => {
    const res = await api.get(`/bidding/wallet/${participantId}`)
    return res.data  // returns { participantId, balance }
  },

  leaderboard: () =>
    api.get("/dashboard/wallet/leaderboard")
         .then(res => res.data),

  highestBid: async (auctionId: string, playerId: string) => {
    const res = await api.get(`/bidding/highest/${auctionId}/${playerId}`)
    return res.data
  },

  /* ✅ ADD THIS */
  passPlayer: async (data: {
    auctionId: string
    playerId: string
    participantId: string
  }) => {
    const res = await api.post("/bidding/pass", data)
    return res.data
  },
}