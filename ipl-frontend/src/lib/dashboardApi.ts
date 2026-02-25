import { api } from "./api";

export const dashboardApi = {
  soldPlayers: () =>
    api.get("/dashboard/players/sold").then(res => res.data),

  unsoldPlayers: () =>
    api.get("/dashboard/players/unsold").then(res => res.data),

  leaderboard: () =>
    api.get("/dashboard/wallet/leaderboard").then(res => res.data),

  participantProfile: (participantId: string, auctionId: string) =>
    api
      .get(`/dashboard/participant/${participantId}/auction/${auctionId}`)
      .then(res => res.data),
};