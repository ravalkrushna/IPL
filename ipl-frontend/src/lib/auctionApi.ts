import { api } from "./api"

export const auctionApi = {
  active: () =>
    api.get("/auctions/active").then(res => res.data),

  list: () =>
    api.get("/auctions/list").then(res => res.data),

  createAuction: (data: { name: string }) =>
    api.post("/auctions/create", data).then(res => res.data),

  updateStatus: (id: string, status: string) =>
    api.put(`/auctions/status/${id}`, { status }).then(res => res.data),

  getById: (id: string) =>
    api.get(`/auctions/get/${id}`).then(res => res.data),

  pause: (id: string) =>
    api.put(`/auctions/${id}/pause`).then(res => res.data),

  resume: (id: string) =>
    api.put(`/auctions/${id}/resume`).then(res => res.data),

  end: (id: string) =>
    api.put(`/auctions/${id}/end`).then(res => res.data),
}