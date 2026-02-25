import { create } from "zustand"

type BidEntry = {
  squadName: string
  amount: number
  timestamp: number
}

type SoldInfo = {
  squadName: string
  playerName: string
  amount: number
}

type AuctionRoomState = {
  squadName: string
  seconds: number
  soldInfo: SoldInfo | null
  liveBid: number
  bidFeed: BidEntry[]
  wallet: number | null
  showSquadDialog: boolean
  timerKey: number
  // Non-null while we're waiting for the backend to advance to a NEW player id.
  // Holds the id of the player that was just sold/unsold so the UI can show
  // a loading state and disable bidding until a different player arrives.
  pendingNextPlayer: string | null

  setSquadName: (name: string) => void
  setSeconds: (s: number) => void
  decrementSeconds: () => void
  setSoldInfo: (info: SoldInfo | null) => void
  setLiveBid: (amount: number) => void
  addBidToFeed: (entry: BidEntry) => void
  clearBidFeed: () => void
  setWallet: (amount: number) => void
  resetForNextPlayer: () => void
  setShowSquadDialog: (open: boolean) => void
  setPendingNextPlayer: (playerId: string | null) => void
}

export const useAuctionRoomStore = create<AuctionRoomState>((set) => ({
  squadName: "",
  seconds: 10,
  soldInfo: null,
  liveBid: 0,
  bidFeed: [],
  wallet: null,
  showSquadDialog: false,
  timerKey: 0,
  pendingNextPlayer: null,

  setSquadName: (name) => set({ squadName: name }),
  setSeconds: (s) => set({ seconds: s }),
  decrementSeconds: () =>
    set((state) => ({ seconds: Math.max(0, state.seconds - 1) })),
  setSoldInfo: (info) => set({ soldInfo: info }),
  setLiveBid: (amount) => set({ liveBid: amount }),
  addBidToFeed: (entry) =>
    set((state) => ({
      bidFeed: [entry, ...state.bidFeed.slice(0, 19)],
    })),
  clearBidFeed: () => set({ bidFeed: [] }),
  setWallet: (amount) => set({ wallet: amount }),
  resetForNextPlayer: () =>
    set((state) => ({
      liveBid: 0,
      bidFeed: [],
      soldInfo: null,
      seconds: 10,
      timerKey: state.timerKey + 1,
    })),
  setShowSquadDialog: (open) => set({ showSquadDialog: open }),
  setPendingNextPlayer: (playerId) => set({ pendingNextPlayer: playerId }),
}))