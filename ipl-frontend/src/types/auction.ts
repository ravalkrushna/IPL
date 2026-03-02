export type AuctionStatus = "PRE_AUCTION" | "LIVE" | "PAUSED" | "COMPLETED"

export interface Auction {
  id: string
  name: string
  status: AuctionStatus
  analysisTimerSecs: number
  minBidIncrement: number
  createdAt: number
  updatedAt: number
}

export interface AuctionPool {
  id: string
  auctionId: string
  poolType: "BATSMAN" | "BOWLER" | "ALLROUNDER" | "WICKETKEEPER"
  status: "PENDING" | "ACTIVE" | "PAUSED" | "COMPLETED"
  sequenceOrder: number
}

export interface Participant {
  id: string
  name: string
  squadName?: string
  walletBalance?: number
}