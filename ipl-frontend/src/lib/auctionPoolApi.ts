import { api } from "./api"
import { Player } from "@/types/player"

export interface PoolResponse {
  id: string
  auctionId: string
  poolType: string
  status: "PENDING" | "ACTIVE" | "PAUSED" | "COMPLETED"
  sequenceOrder: number
  totalPlayers: number
  auctionedCount: number
  remaining: number
}

export const auctionEngineApi = {
  /** Admin: load next player from active pool + auto-starts analysis timer */
  nextPlayer: (auctionId: string): Promise<{ message: string; currentPlayer: Player | null; biddingOpen: boolean }> =>
    api.post(`/auctions/${auctionId}/engine/next-player`).then(r => r.data),

  /** Admin: manually restart analysis timer for current player */
  startAnalysis: (auctionId: string): Promise<{ message: string }> =>
    api.post(`/auctions/${auctionId}/engine/start-analysis`).then(r => r.data),

  /** Get current engine state (current player, biddingOpen, activePool) */
  state: (auctionId: string): Promise<{
    currentPlayer: Player | null
    biddingOpen: boolean
    activePool: string | null
  }> =>
    api.get(`/auctions/${auctionId}/engine/state`).then(r => r.data),
}

export const auctionPoolApi = {
  /** Get all pools for an auction */
  getPools: (auctionId: string): Promise<PoolResponse[]> =>
    api.get(`/auctions/${auctionId}/pools`).then(r => r.data),

  /** Get currently active pool */
  getActivePool: (auctionId: string): Promise<PoolResponse | null> =>
    api.get(`/auctions/${auctionId}/pools/active`).then(r => r.data).catch(() => null),

  /**
   * Start or resume a pool (PENDING→ACTIVE or PAUSED→ACTIVE).
   * Backend rejects if another pool is already ACTIVE.
   */
  activatePool: (auctionId: string, poolType: string): Promise<PoolResponse> =>
    api.post(`/auctions/${auctionId}/pools/activate`, { poolType }).then(r => r.data),

  /**
   * Pause the currently active pool (ACTIVE→PAUSED).
   * Timer is cancelled, bidding closes. Pool stays resumable.
   */
  pausePool: (auctionId: string): Promise<PoolResponse> =>
    api.post(`/auctions/${auctionId}/pools/pause`).then(r => r.data),

  /**
   * Permanently complete the active or paused pool (→COMPLETED).
   * Irreversible — use pausePool if switching pools temporarily.
   */
  completePool: (auctionId: string): Promise<PoolResponse> =>
    api.post(`/auctions/${auctionId}/pools/complete`).then(r => r.data),
}