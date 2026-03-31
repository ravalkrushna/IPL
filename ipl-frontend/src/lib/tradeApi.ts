import { api } from "./api"

export type TradeStatus = "PENDING" | "ACCEPTED" | "CLOSED" | "REJECTED" | "CANCELLED"
export type TradeType = "TRADE" | "SELL" | "LOAN"

export type TradeResponse = {
  id: string
  auctionId: string
  fromSquadId: string
  toSquadId: string
  fromPlayerIds: string[]
  toPlayerIds: string[]
  cashFromToTo: number
  cashToToFrom: number
  tradeType: TradeType
  status: TradeStatus
  createdAt: number
  updatedAt: number
}

export const tradeApi = {
  listByAuction: (auctionId: string): Promise<TradeResponse[]> =>
    api.get(`/trades/auction/${auctionId}`).then((r) => r.data),

  create: (payload: {
    auctionId: string
    fromSquadId: string
    toSquadId: string
    fromPlayerIds: string[]
    toPlayerIds: string[]
    cashFromToTo?: number
    cashToToFrom?: number
  }): Promise<TradeResponse> =>
    api.post("/trades", payload).then((r) => r.data),

  createSellListing: (payload: {
    auctionId: string
    fromSquadId: string
    playerId: string
    askingPrice: number
  }): Promise<TradeResponse> =>
    api.post("/trades/sell-listing", payload).then((r) => r.data),

  createLoan: (payload: {
    auctionId: string
    fromSquadId: string
    playerId: string
    loanFee: number
  }): Promise<TradeResponse> =>
    api.post("/trades/loan", payload).then((r) => r.data),

  acceptSellListing: (tradeId: string, buyerSquadId: string): Promise<TradeResponse> =>
    api.post(`/trades/${tradeId}/accept-sell`, { buyerSquadId }).then((r) => r.data),

  approveLoan: (tradeId: string, borrowerSquadId: string): Promise<TradeResponse> =>
    api.post(`/trades/${tradeId}/approve-loan`, { borrowerSquadId }).then((r) => r.data),

  closeLoan: (tradeId: string): Promise<TradeResponse> =>
    api.post(`/trades/${tradeId}/close-loan`).then((r) => r.data),

  accept: (tradeId: string): Promise<TradeResponse> =>
    api.post(`/trades/${tradeId}/accept`).then((r) => r.data),

  reject: (tradeId: string): Promise<TradeResponse> =>
    api.post(`/trades/${tradeId}/reject`).then((r) => r.data),

  cancel: (tradeId: string): Promise<TradeResponse> =>
    api.post(`/trades/${tradeId}/cancel`).then((r) => r.data),
}

