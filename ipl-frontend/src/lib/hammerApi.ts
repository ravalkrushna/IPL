import { api } from "./api"
import { Participant } from "@/types/auction"

export const hammerApi = {
  autoHammer: (data: { playerId: string; auctionId: string }): Promise<void> =>
    api.post("/hammer", data).then(r => r.data),

  manualHammer: (data: {
    playerId: string
    auctionId: string
    participantId?: string        // now optional
    newParticipantName?: string   // new
    finalAmount: number
  }): Promise<void> =>
    api.post("/hammer/manual", data).then(r => r.data),

  getParticipants: (auctionId: string): Promise<Participant[]> =>
    api.get(`/participants/auction/${auctionId}`).then(r => r.data),
}

// New — global participant management
export const participantApi = {
  getAll: (): Promise<{ id: string; name: string }[]> =>
    api.get("/participants").then(r => r.data),

  addToAuction: (auctionId: string, data: {
    participantId?: string
    newParticipantName?: string
  }): Promise<void> =>
    api.post(`/participants/auction/${auctionId}`, data).then(r => r.data),
}