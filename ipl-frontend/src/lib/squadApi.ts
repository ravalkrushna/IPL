import { api } from "./api"

export const squadApi = {
  mySquad: async (auctionId: string, participantId: string) => {
    const res = await api.get(
      `/squads/my/${auctionId}`,
      { params: { participantId } }
    )
    return res.data
  },

  create: async (data: {
    auctionId: string
    participantId: string
    name: string
  }) => {
    const res = await api.post("/squads/create", data)
    return res.data
  },

  allSquads: async (auctionId: string) => {
    const res = await api.get(`/squads/all/${auctionId}`)
    return res.data
  },
}