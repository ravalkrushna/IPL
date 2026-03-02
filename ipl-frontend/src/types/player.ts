export type Player = {
  id: string
  name: string
  basePrice?: number | string
  specialism?: string        // ← add
  country?: string           // ← add
  age?: number               // ← add
  testCaps?: number          // ← add
  odiCaps?: number           // ← add
  t20Caps?: number           // ← add
  battingStyle?: string      // ← add
  bowlingStyle?: string      // ← add
}