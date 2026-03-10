import { create } from "zustand"

// ─── Types ────────────────────────────────────────────────────────────────

interface SoldInfo {
  playerName: string
  squadName?: string
  amount?: number
  unsold?: boolean
  timestamp: string
}

// ─── State shape ─────────────────────────────────────────────────────────

interface AuctionRoomState {
  // ── Sold overlay ──
  soldInfo: SoldInfo | null
  setSoldInfo: (info: SoldInfo | null) => void
  lastSeenResultTimestamp: string | null
  setLastSeenResultTimestamp: (ts: string | null) => void

  // ── Manual Hammer dialog ──
  showManualHammer: boolean
  setShowManualHammer: (v: boolean) => void
  hammerParticipantId: string
  setHammerParticipantId: (id: string) => void
  hammerAmount: number | null
  setHammerAmount: (v: number | null) => void
  hammerRawInput: string
  setHammerRawInput: (v: string) => void
  hammerInputError: string
  setHammerInputError: (v: string) => void
  /**
   * NEW — unit for the split number+unit custom amount input.
   * "Thousand" | "Lakh" | "Crore"  (default: "Lakh")
   */
  hammerUnit: string
  setHammerUnit: (unit: string) => void

  // ── Squad panel ──
  expandedSquad: string | null
  setExpandedSquad: (id: string | null) => void

  // ── Add participant dialog ──
  showAddParticipant: boolean
  setShowAddParticipant: (v: boolean) => void
  addSearch: string
  setAddSearch: (v: string) => void
  addNewName: string
  setAddNewName: (v: string) => void
  addShowNewForm: boolean
  setAddShowNewForm: (v: boolean) => void

  // ── Session / end auction ──
  confirmEnd: boolean
  setConfirmEnd: (v: boolean) => void

  // ── Unsold confirm modal ──
  showUnsoldConfirm: boolean
  setShowUnsoldConfirm: (v: boolean) => void

  // ── Participant view: squad dialog ──
  showSquadDialog: boolean
  setShowSquadDialog: (v: boolean) => void
  squadNameInput: string
  setSquadNameInput: (v: string) => void

  // ── Participant view: wallet ──
  myBalance: number | null
  setMyBalance: (v: number | null) => void
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useAuctionRoomStore = create<AuctionRoomState>((set) => ({
  // ── Sold overlay ──
  soldInfo: null,
  setSoldInfo: (info) => set({ soldInfo: info }),
  lastSeenResultTimestamp: null,
  setLastSeenResultTimestamp: (ts) => set({ lastSeenResultTimestamp: ts }),

  // ── Manual Hammer dialog ──
  showManualHammer: false,
  setShowManualHammer: (v) => set({ showManualHammer: v }),
  hammerParticipantId: "",
  setHammerParticipantId: (id) => set({ hammerParticipantId: id }),
  hammerAmount: null,
  setHammerAmount: (v) => set({ hammerAmount: v }),
  hammerRawInput: "",
  setHammerRawInput: (v) => set({ hammerRawInput: v }),
  hammerInputError: "",
  setHammerInputError: (v) => set({ hammerInputError: v }),
  // NEW
  hammerUnit: "Lakh",
  setHammerUnit: (unit) => set({ hammerUnit: unit }),

  // ── Squad panel ──
  expandedSquad: null,
  setExpandedSquad: (id) => set({ expandedSquad: id }),

  // ── Add participant dialog ──
  showAddParticipant: false,
  setShowAddParticipant: (v) => set({ showAddParticipant: v }),
  addSearch: "",
  setAddSearch: (v) => set({ addSearch: v }),
  addNewName: "",
  setAddNewName: (v) => set({ addNewName: v }),
  addShowNewForm: false,
  setAddShowNewForm: (v) => set({ addShowNewForm: v }),

  // ── Session / end auction ──
  confirmEnd: false,
  setConfirmEnd: (v) => set({ confirmEnd: v }),

  // ── Unsold confirm modal ──
  showUnsoldConfirm: false,
  setShowUnsoldConfirm: (v) => set({ showUnsoldConfirm: v }),

  // ── Participant view: squad dialog ──
  showSquadDialog: false,
  setShowSquadDialog: (v) => set({ showSquadDialog: v }),
  squadNameInput: "",
  setSquadNameInput: (v) => set({ squadNameInput: v }),

  // ── Participant view: wallet ──
  myBalance: null,
  setMyBalance: (v) => set({ myBalance: v }),
}))