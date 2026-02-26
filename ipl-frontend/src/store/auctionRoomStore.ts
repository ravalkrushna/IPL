import { create } from "zustand"

type SoldInfo = { squadName: string; playerName: string; amount: number }
type BidEntry = { squadName: string; amount: number; timestamp: number }

type AuctionRoomState = {
  // ── server-derived ──
  squadName: string
  wallet: number | null
  seconds: number
  timerKey: number

  // ── overlays / feeds ──
  soldInfo: SoldInfo | null
  bidFeed: BidEntry[]
  pendingNextPlayer: string | null

  // ── dialogs ──
  showSquadDialog: boolean

  // ── UI state (replaces useState) ──
  confirmEnd: boolean
  expandedSquad: string | null

  // ── actions ──
  setSquadName: (name: string) => void
  setWallet: (balance: number) => void
  setSeconds: (s: number) => void
  decrementSeconds: () => void
  setSoldInfo: (info: SoldInfo | null) => void
  addBidToFeed: (bid: BidEntry) => void
  resetForNextPlayer: () => void
  setShowSquadDialog: (open: boolean) => void
  setPendingNextPlayer: (id: string | null) => void
  setConfirmEnd: (v: boolean) => void
  setExpandedSquad: (key: string | null) => void
}

export const useAuctionRoomStore = create<AuctionRoomState>((set) => ({
  // ── initial state ──
  squadName: "",
  wallet: null,
  seconds: 10,
  timerKey: 0,
  soldInfo: null,
  bidFeed: [],
  pendingNextPlayer: null,
  showSquadDialog: false,
  confirmEnd: false,
  expandedSquad: null,

  // ── actions ──
  setSquadName: (name) => set({ squadName: name }),
  setWallet: (balance) => set({ wallet: balance }),
  setSeconds: (s) => set({ seconds: s }),
  decrementSeconds: () =>
    set((state) => ({ seconds: Math.max(0, state.seconds - 1) })),
  setSoldInfo: (info) => set({ soldInfo: info }),
  addBidToFeed: (bid) =>
    set((state) => ({ bidFeed: [...state.bidFeed, bid] })),
  resetForNextPlayer: () =>
    set((state) => ({
      soldInfo: null,
      bidFeed: [],
      seconds: 10,
      timerKey: state.timerKey + 1,
    })),
  setShowSquadDialog: (open) => set({ showSquadDialog: open }),
  setPendingNextPlayer: (id) => set({ pendingNextPlayer: id }),
  setConfirmEnd: (v) => set({ confirmEnd: v }),
  setExpandedSquad: (key) => set({ expandedSquad: key }),
}))