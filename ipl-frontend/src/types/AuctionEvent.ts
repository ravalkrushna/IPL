export type AuctionEventType =
  | "BID_PLACED"
  | "PLAYER_SOLD"
  | "PLAYER_UNSOLD"
  | "NEXT_PLAYER"
  | "ANALYSIS_STARTED"
  | "BIDDING_OPEN"
  | "WALLETS_UPDATED"
  | "POOL_STARTED"
  | "POOL_PAUSED"
  | "POOL_ENDED"
  | "AUCTION_ENDED"
  | "PLAYER_PASSED"
  | "POOL_EXHAUSTED"

export interface WalletEntry {
  participantId: string
  participantName: string
  balance: number
}

export interface AuctionEvent {
  type: AuctionEventType

  // BID_PLACED
  playerId?: string
  participantId?: string
  participantName?: string
  squadName?: string
  amount?: number
  isManual?: boolean

  // NEXT_PLAYER
  playerName?: string
  basePrice?: number
  analysisTimerSecs?: number

  // WALLETS_UPDATED
  wallets?: WalletEntry[]

  // POOL_STARTED / POOL_ENDED / AUCTION_ENDED
  message?: string
  auctionId?: string

  [key: string]: unknown
}