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
  catches: number
  stumpings: number
  runOutsDirect: number
  runOutsIndirect: number
  fantasyPoints: number
}

export type FantasyPlayerResponse = {
  playerId: string
  playerName: string
  iplTeam: string
  specialism: string
  totalPoints: number
  matchesPlayed: number
  matches: FantasyPlayerMatchEntry[]
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

export const fantasyApi = {
  // Auction-scoped leaderboard
  leaderboard: (auctionId: string): Promise<FantasyLeaderboardResponse> =>
    api.get(`/fantasy/leaderboard/${auctionId}`).then(r => r.data),

  squad: (squadId: string): Promise<FantasySquadResponse> =>
    api.get(`/fantasy/squad/${squadId}`).then(r => r.data),

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

  matches: (): Promise<MatchListEntry[]> =>
    api.get(`/fantasy/matches`).then(r => r.data),

  playerBreakdown: (playerId: string): Promise<PlayerLeaderboardEntry> =>
    api.get(`/fantasy/player/${playerId}/breakdown`).then(r => r.data),

  syncNow: (): Promise<string> =>
    api.post(`/fantasy/sync`).then(r => r.data),
}