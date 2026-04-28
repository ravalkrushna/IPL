import { api } from "./api"

export type MidSeasonPhase = "NOT_STARTED" | "RETENTION_ENTRY" | "LIVE" | "COMPLETED"

export type MidSeasonRetention = {
  id: string
  auctionId: string
  squadId: string
  playerId: string
  playerName: string
  retentionOrder: number
  retentionCost: number
  createdAt: number
}

export type SquadRetentionSummary = {
  squadId: string
  squadName: string
  retentions: MidSeasonRetention[]
  totalCostCr: number
  lockedPoints: number | null
}

export type MidSeasonStatus = {
  auctionId: string
  midSeasonPhase: MidSeasonPhase
  pointsLockedAt: number | null
  squads: SquadRetentionSummary[]
}

export const RETENTION_COSTS_CR = [4, 8, 12, 16] // cost for 1st, 2nd, 3rd, 4th retention in CR
export const RETENTION_CUMULATIVE_CR = [4, 12, 24, 40] // cumulative total

export function retentionCostLabel(retentionCount: number): string {
  if (retentionCount === 0) return "Free"
  return `${RETENTION_CUMULATIVE_CR[retentionCount - 1]} CR`
}

export const midSeasonApi = {
  getStatus: (auctionId: string): Promise<MidSeasonStatus> =>
    api.get(`/mid-season/${auctionId}/status`).then((r) => r.data),

  startRetentionPhase: (auctionId: string): Promise<unknown> =>
    api.post(`/mid-season/${auctionId}/start`).then((r) => r.data),

  getRetentions: (auctionId: string): Promise<MidSeasonRetention[]> =>
    api.get(`/mid-season/${auctionId}/retentions`).then((r) => r.data),

  getSquadRetentions: (auctionId: string, squadId: string): Promise<MidSeasonRetention[]> =>
    api.get(`/mid-season/${auctionId}/squads/${squadId}/retentions`).then((r) => r.data),

  addRetention: (auctionId: string, squadId: string, playerId: string): Promise<MidSeasonRetention> =>
    api.post(`/mid-season/${auctionId}/squads/${squadId}/retain`, { playerId }).then((r) => r.data),

  removeRetention: (auctionId: string, squadId: string, playerId: string): Promise<void> =>
    api.delete(`/mid-season/${auctionId}/squads/${squadId}/retain/${playerId}`).then((r) => r.data),

  finalize: (auctionId: string): Promise<unknown> =>
    api.post(`/mid-season/${auctionId}/finalize`).then((r) => r.data),
}
