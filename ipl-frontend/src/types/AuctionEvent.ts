export type AuctionEventType =
  | "NEW_BID"
  | "PLAYER_SOLD"
  | "WALLET_UPDATE"
  | "TIMER_TICK"
  | "SYSTEM_MESSAGE"

export interface AuctionEvent {
  type: AuctionEventType
  playerId: string

  participantId?: string
  amount?: number
  walletBalance?: number
  message?: string
  squadName?: string
}