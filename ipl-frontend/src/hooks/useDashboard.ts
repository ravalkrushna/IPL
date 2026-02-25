import { dashboardApi } from "@/lib/dashboardApi";
import { useQuery } from "@tanstack/react-query";

export const useSoldPlayers = () =>
  useQuery({
    queryKey: ["soldPlayers"],
    queryFn: dashboardApi.soldPlayers,
  });

export const useUnsoldPlayers = () =>
  useQuery({
    queryKey: ["unsoldPlayers"],
    queryFn: dashboardApi.unsoldPlayers,
  });

export const useLeaderboard = () =>
  useQuery({
    queryKey: ["leaderboard"],
    queryFn: dashboardApi.leaderboard,
  });

export const useParticipantProfile = (
  participantId: string,
  auctionId: string
) =>
  useQuery({
    queryKey: ["participantProfile", participantId, auctionId],
    queryFn: () =>
      dashboardApi.participantProfile(participantId, auctionId),
    enabled: !!participantId && !!auctionId,
  });