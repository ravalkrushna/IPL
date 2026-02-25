/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "./api"

export const hammerApi = {
  hammerPlayer: (data: any) =>
    api.post("/hammer/player", data)
       .then(res => res.data),
}