import { api } from "./api"
import { Player } from "@/types/player"

export interface LeaderboardEntry {
  participantId: string
  participantName: string
  squadName: string
  balance: number
}

export const dashboardApi = {
  soldPlayers: (): Promise<Player[]> =>
    api.get("/dashboard/players/sold").then(r => r.data),

  unsoldPlayers: (): Promise<Player[]> =>
    api.get("/dashboard/players/unsold").then(r => r.data),

  // Leaderboard is now per-auction
  leaderboard: (auctionId: string): Promise<LeaderboardEntry[]> =>
    api.get(`/dashboard/wallet/leaderboard/${auctionId}`).then(r => r.data),

  participantProfile: (participantId: string, auctionId: string) =>
    api.get(`/dashboard/participant/${participantId}/auction/${auctionId}`).then(r => r.data),
}