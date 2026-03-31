import { api } from "@/lib/api"

// ── Global leaderboard types ───────────────────────────────────────────────

export type TeamLeaderboardEntry = {
  rank: number
  teamName: string
  totalPoints: number
  playerCount: number
  topPlayer: string | null
  topPlayerPoints: number
}

export type PlayerLeaderboardEntry = {
  rank: number
  playerName: string
  iplTeam: string | null
  auctionTeam: string | null
  totalPoints: number
  matchBreakdown: Record<string, number>
}

export type MatchListEntry = {
  matchId: string
  matchLabel: string
  matchNo: number
  matchDate: number
}

export type FantasyLeaderboardEntry = {
  rank: number
  squadId: string
  squadName: string
  participantName: string
  totalPoints: number
  matchesPlayed: number
}

export type FantasyLeaderboardResponse = {
  auctionId: string
  entries: FantasyLeaderboardEntry[]
}

export type FantasySquadPlayerEntry = {
  playerId: string
  playerName: string
  specialism: string
  iplTeam: string
  soldPrice: number | null
  totalPoints: number
  matchesPlayed: number
}

export type FantasySquadResponse = {
  squadId: string
  squadName: string
  auctionId: string
  totalPoints: number
  players: FantasySquadPlayerEntry[]
}

export type FantasyPointBreakdown = {
  playingXi: number
  batting: number
  bowling: number
  fielding: number
}

export type FantasyPlayerMatchEntry = {
  matchId: string
  matchNo: number
  teamA: string
  teamB: string
  matchDate: number
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  dismissed: boolean
  wickets: number
  dotBalls?: number
  catches: number
  stumpings: number
  runOutsDirect: number
  runOutsIndirect: number
  fantasyPoints: number
  pointBreakdown?: FantasyPointBreakdown | null
}

export type FantasyPlayerResponse = {
  playerId: string
  playerName: string
  iplTeam: string
  specialism: string
  totalPoints: number
  matchesPlayed: number
  matches2025: FantasyPlayerMatchEntry[]
  matches2026: FantasyPlayerMatchEntry[]
}

export type FantasyMatchPlayerEntry = {
  playerId: string
  playerName: string
  iplTeam: string
  specialism: string
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  dismissed: boolean
  wickets: number
  dotBalls?: number
  lbwBowledCount: number
  oversBowled: number
  runsGiven: number
  maidens: number
  catches: number
  stumpings: number
  runOutsDirect: number
  runOutsIndirect: number
  fantasyPoints: number
}

export type FantasyMatchResponse = {
  matchId: string
  matchNo: number
  teamA: string
  teamB: string
  matchDate: number
  performances: FantasyMatchPlayerEntry[]
}

export type IplCareerStats = {
  playerName: string
  iplTeam: string
  specialism: string
  season: string
  matchesPlayed: number
  totalRuns: number
  highScore: number
  battingAverage: number
  strikeRate: number
  totalWickets: number
  bowlingEconomy: number
  totalCatches: number
  totalStumpings: number
  totalFours: number
  totalSixes: number
  fantasyPoints: number
}

type AdminFantasyResponse = Record<string, unknown>
type IplFeedMatchesResponse = {
  count: number
  matches: Array<{ id: string; [k: string]: unknown }>
  diagnostics?: Record<string, unknown>
  hint?: string
}

const adminBase = (() => {
  const base = api.defaults.baseURL ?? "http://localhost:8080/api/v1"
  return String(base).replace(/\/api\/v1\/?$/, "")
})()

export const fantasyApi = {
  // Auction-scoped leaderboard
  leaderboard: (auctionId: string, season = "2026"): Promise<FantasyLeaderboardResponse> =>
    api.get(`/fantasy/leaderboard/${auctionId}`, { params: { season } }).then(r => r.data),

  squad: (squadId: string, season = "2026"): Promise<FantasySquadResponse> =>
    api.get(`/fantasy/squad/${squadId}`, { params: { season } }).then(r => r.data),

  player: (playerId: string): Promise<FantasyPlayerResponse> =>
    api.get(`/fantasy/player/${playerId}`).then(r => r.data),

  match: (matchId: string): Promise<FantasyMatchResponse> =>
    api.get(`/fantasy/match/${matchId}`).then(r => r.data),

  career: (playerId: string): Promise<IplCareerStats> =>
    api.get(`/fantasy/player/${playerId}/ipl-career`).then(r => r.data),

  // Global leaderboards
  globalTeams: (): Promise<TeamLeaderboardEntry[]> =>
    api.get(`/fantasy/leaderboard/teams`).then(r => r.data),

  globalPlayers: (limit = 50): Promise<PlayerLeaderboardEntry[]> =>
    api.get(`/fantasy/leaderboard/players`, { params: { limit } }).then(r => r.data),

  matches: (season = "2026"): Promise<MatchListEntry[]> =>
    api.get(`/fantasy/matches`, { params: { season } }).then(r => r.data),

  playerBreakdown: (playerId: string): Promise<PlayerLeaderboardEntry> =>
    api.get(`/fantasy/player/${playerId}/breakdown`).then(r => r.data),

  syncNow: (): Promise<string> =>
    api.post(`/fantasy/sync`).then(r => r.data),

  adminIplMatches: (): Promise<IplFeedMatchesResponse> =>
    api.get(`${adminBase}/admin/fantasy/ipl-matches`).then((r) => r.data),

  adminSyncNow: (matchId?: string): Promise<AdminFantasyResponse> =>
    api.post(`${adminBase}/admin/fantasy/sync-now`, undefined, { params: matchId ? { matchId } : undefined }).then((r) => r.data),

  adminSyncPointsSheet: (): Promise<AdminFantasyResponse> =>
    api.post(`${adminBase}/admin/fantasy/sync-points-sheet`).then((r) => r.data),

  adminRebuildAndSyncAll: (season = "2026"): Promise<AdminFantasyResponse> =>
    api.post(`${adminBase}/admin/fantasy/rebuild-and-sync-all`, undefined, { params: { season } }).then((r) => r.data),
}