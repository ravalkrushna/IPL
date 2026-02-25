import { api } from "./api"

export const auctionApi = {
  active: () =>
    api.get("/auctions/active").then(res => res.data),

  list: () =>
    api.get("/auctions/list").then(res => res.data),

  createAuction: (data: { name: string }) =>
    api.post("/auctions/create", data).then(res => res.data),

  updateStatus: (id: string, status: string) =>
    api.put(`/auctions/status/${id}`, { status })
       .then(res => res.data),

  getById: (id: string) =>
  api.get(`/auctions/get/${id}`).then(res => res.data),
}