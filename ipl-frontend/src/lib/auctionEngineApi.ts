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

export interface LastResult {
  playerName: string
  squadName: string | null
  amount: number | null
  unsold: boolean
  timestamp: number
}

export interface EngineState {
  currentPlayer: Player | null
  biddingOpen: boolean
  analysisSeconds: number
  analysisTotalSecs: number
  activePool: string | null
  pools: PoolResponse[]
  lastResult: LastResult | null
  poolExhausted: boolean
  upcomingPlayers: Player[]
  auctionRound?: number
  unsoldCandidates?: Player[]
  isReauctionMode?: boolean
  phase1Exhausted?: boolean
}

export interface ReauctionPhaseStatus {
  isReauctionMode: boolean
  phase1Exhausted: boolean
  squadsNeedingPlayers: number
  squadsWithBudget: number
  hasRemainingPoolPlayers: boolean
}

export const auctionEngineApi = {
  /** Admin: load next player from active pool + auto-starts analysis timer */
  nextPlayer: (auctionId: string): Promise<{ message: string; currentPlayer: Player | null; biddingOpen: boolean }> =>
    api.post(`/auctions/${auctionId}/engine/next-player`).then(r => r.data),

  /** Admin: manually restart analysis timer for current player */
  startAnalysis: (auctionId: string): Promise<{ message: string }> =>
    api.post(`/auctions/${auctionId}/engine/start-analysis`).then(r => r.data),

  /** Poll this every 1.5s — replaces all SSE events */
  state: (auctionId: string): Promise<EngineState> =>
    api.get(`/auctions/${auctionId}/engine/state`).then(r => r.data),

  /** Poll this for sold/unsold overlay if needed standalone */
  lastResult: (auctionId: string): Promise<LastResult | null> =>
    api.get(`/auctions/${auctionId}/engine/last-result`).then(r => r.data),

  /** Start unsold-only round (round 2+) after current queue exhausts */
  startUnsoldRound: (auctionId: string): Promise<{ message: string; auctionRound: number; queuedPlayers: number }> =>
    api.post(`/auctions/${auctionId}/engine/start-unsold-round`).then(r => r.data),

  /** Get re-auction phase status (whether Phase 1 is exhausted, squads needing players, etc.) */
  getReauctionPhaseStatus: (auctionId: string): Promise<ReauctionPhaseStatus> =>
    api.get(`/auctions/${auctionId}/engine/reauction-phase-status`).then(r => r.data),

  /** Admin: start Phase 2 of re-auction (bring in remaining pool players) */
  startRemainingPool: (auctionId: string): Promise<{ message: string }> =>
    api.post(`/auctions/${auctionId}/engine/start-remaining-pool`).then(r => r.data),
}

export const auctionPoolApi = {
  /** Get all pools for an auction */
  getPools: (auctionId: string): Promise<PoolResponse[]> =>
    api.get(`/auctions/${auctionId}/pools`).then(r => r.data),

  /** Get currently active pool */
  getActivePool: (auctionId: string): Promise<PoolResponse | null> =>
    api.get(`/auctions/${auctionId}/pools/active`).then(r => r.data).catch(() => null),

  /** Start or resume a pool (PENDING→ACTIVE or PAUSED→ACTIVE) */
  activatePool: (auctionId: string, poolType: string): Promise<PoolResponse> =>
    api.post(`/auctions/${auctionId}/pools/activate`, { poolType }).then(r => r.data),

  /** Pause the currently active pool (ACTIVE→PAUSED) */
  pausePool: (auctionId: string): Promise<PoolResponse> =>
    api.post(`/auctions/${auctionId}/pools/pause`).then(r => r.data),

  /** Permanently complete the active or paused pool */
  completePool: (auctionId: string): Promise<PoolResponse> =>
    api.post(`/auctions/${auctionId}/pools/complete`).then(r => r.data),
}