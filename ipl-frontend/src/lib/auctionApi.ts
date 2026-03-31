import { api } from "./api"
import { Auction } from "@/types/auction"

export const auctionApi = {
  list: (): Promise<Auction[]> =>
    api.get("/auctions/list").then(r => r.data),

  activeList: (): Promise<Auction[]> =>
    api.get("/auctions/active").then(r => r.data),

  getById: (id: string): Promise<Auction> =>
    api.get(`/auctions/get/${id}`).then(r => r.data),

  create: (data: { name: string; analysisTimerSecs?: number }): Promise<Auction> =>
    api.post("/auctions/create", data).then(r => r.data),

  updateStatus: (id: string, status: string): Promise<Auction> =>
    api.put(`/auctions/status/${id}`, { status }).then(r => r.data),

  update: (id: string, data: { name: string; analysisTimerSecs: number }): Promise<Auction> =>
    api.put(`/auctions/${id}`, data).then(r => r.data),

  pause: (id: string): Promise<Auction> =>
    api.put(`/auctions/${id}/pause`).then(r => r.data),

  resume: (id: string): Promise<Auction> =>
    api.put(`/auctions/${id}/resume`).then(r => r.data),

  end: (id: string): Promise<Auction> =>
    api.put(`/auctions/${id}/end`).then(r => r.data),

  startReauction: (id: string): Promise<Auction> =>
    api.put(`/auctions/${id}/reauction/start`).then(r => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/auctions/${id}`).then(r => r.data),
}