/* eslint-disable @typescript-eslint/no-explicit-any */

import { api } from "./api";

export const playerApi = {

  list: (filters: any) =>
    api.post("/players/list", filters).then(res => res.data),

  sold: () =>
    api.get("/players/sold").then(res => res.data),

  unsold: () =>
    api.get("/players/unsold").then(res => res.data),

  currentPlayer: () =>
  api.get("/auction-engine/current-player")
     .then(res => res.data),
}