import { api } from "./api"

export const auctionEngineApi = {
  currentPlayer: () =>
    api.get("/auction-engine/current-player/{auctionId}")
       .then(res => res.data),
}