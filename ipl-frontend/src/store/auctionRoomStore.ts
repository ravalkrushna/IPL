import { create } from "zustand"

export type BidEntry = {
  squadName: string
  participantName: string
  amount: number
  isManual: boolean
  timestamp: number
}

export type SoldInfo = {
  playerName: string
  squadName: string | null
  amount: number | null
  unsold: boolean
  timestamp: number
}

type AuctionRoomState = {
  // ── Sold / unsold overlay (driven by polling lastResult) ──
  soldInfo: SoldInfo | null
  setSoldInfo: (info: SoldInfo | null) => void
  lastSeenResultTimestamp: number | null
  setLastSeenResultTimestamp: (ts: number | null) => void

  // ── My wallet balance ──
  myBalance: number | null
  setMyBalance: (v: number | null) => void

  // ── Admin UI state ──
  confirmEnd: boolean
  setConfirmEnd: (v: boolean) => void
  showManualHammer: boolean
  setShowManualHammer: (v: boolean) => void
  expandedSquad: string | null
  setExpandedSquad: (key: string | null) => void
  showSquadDialog: boolean
  setShowSquadDialog: (v: boolean) => void

  // ── Squad name creation ──
  squadNameInput: string
  setSquadNameInput: (v: string) => void

  // ── ManualHammerDialog ──
  hammerParticipantId: string
  setHammerParticipantId: (v: string) => void
  hammerAmount: number | ""
  setHammerAmount: (v: number | "") => void

  // ── AddParticipantDialog ──
  addSearch: string
  setAddSearch: (v: string) => void
  addNewName: string
  setAddNewName: (v: string) => void
  addShowNewForm: boolean
  setAddShowNewForm: (v: boolean) => void

  // ── AdminPanel ──
  showAddParticipant: boolean
  setShowAddParticipant: (v: boolean) => void
}

export const useAuctionRoomStore = create<AuctionRoomState>((set) => ({
  // ── Sold / unsold overlay ──
  soldInfo: null,
  setSoldInfo: (info) => set({ soldInfo: info }),
  lastSeenResultTimestamp: null,
  setLastSeenResultTimestamp: (ts) => set({ lastSeenResultTimestamp: ts }),

  // ── My wallet balance ──
  myBalance: null,
  setMyBalance: (v) => set({ myBalance: v }),

  // ── Admin UI state ──
  confirmEnd: false,
  setConfirmEnd: (v) => set({ confirmEnd: v }),
  showManualHammer: false,
  setShowManualHammer: (v) => set({ showManualHammer: v }),
  expandedSquad: null,
  setExpandedSquad: (key) => set({ expandedSquad: key }),
  showSquadDialog: false,
  setShowSquadDialog: (v) => set({ showSquadDialog: v }),

  // ── Squad name creation ──
  squadNameInput: "",
  setSquadNameInput: (v) => set({ squadNameInput: v }),

  // ── ManualHammerDialog ──
  hammerParticipantId: "",
  setHammerParticipantId: (v) => set({ hammerParticipantId: v }),
  hammerAmount: "",
  setHammerAmount: (v) => set({ hammerAmount: v }),

  // ── AddParticipantDialog ──
  addSearch: "",
  setAddSearch: (v) => set({ addSearch: v }),
  addNewName: "",
  setAddNewName: (v) => set({ addNewName: v }),
  addShowNewForm: false,
  setAddShowNewForm: (v) => set({ addShowNewForm: v }),

  // ── AdminPanel ──
  showAddParticipant: false,
  setShowAddParticipant: (v) => set({ showAddParticipant: v }),
}))