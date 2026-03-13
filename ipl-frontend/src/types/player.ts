export type Player = {
  id: string
  name: string
  basePrice?: number | string
  specialism?: string
  country?: string
  age?: number
  testCaps?: number
  odiCaps?: number
  t20Caps?: number
  battingStyle?: string
  bowlingStyle?: string
  iplTeam?: string        // ← add this
  auctioned?: boolean
  sold?: boolean
}