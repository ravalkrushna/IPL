export type Squad = {
  id?: string
  name: string
  participantId?: string
  players?: { id: string; name: string; specialism?: string; soldPrice?: number }[]
}