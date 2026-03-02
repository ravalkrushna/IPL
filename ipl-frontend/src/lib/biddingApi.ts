import { api } from "./api"

export interface HighestBidResponse {
  playerId: string
  participantId: string | null
  participantName: string | null
  amount: number
  isManual: boolean
}

export interface WalletResponse {
  id: string
  participantId: string
  auctionId: string
  balance: number
}

export const biddingApi = {
  placeBid: (data: {
    auctionId: string
    playerId: string
    participantId: string
    amount: number
  }): Promise<string> =>
    api.post("/bidding/place", data).then(r => r.data),

  // Per-auction wallet
  getWallet: (participantId: string, auctionId: string): Promise<WalletResponse> =>
    api.get(`/bidding/wallet/${participantId}/${auctionId}`).then(r => r.data),

  highestBid: (auctionId: string, playerId: string): Promise<HighestBidResponse> =>
    api.get(`/bidding/highest/${auctionId}/${playerId}`).then(r => r.data),

  bidHistory: (auctionId: string, playerId: string) =>
    api.get(`/bidding/history/${auctionId}/${playerId}`).then(r => r.data),

  passPlayer: (data: { auctionId: string; playerId: string; participantId: string }): Promise<string> =>
    api.post("/bidding/pass", data).then(r => r.data),
}