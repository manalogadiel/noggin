export interface ArenaLeaguePlayer {
  rank: number;
  playerName: string;
  nogName: string;
  subject: string;
  xp: number;
  isCurrentUser?: boolean;
}

export interface ArenaBattleStep {
  step: number;
  title: string;
  detail: string;
}

export const ARENA_LEAGUE_TIER = "Doodle league";

export const PROMOTION_ZONE_AFTER_RANK = 7;

export const ARENA_SAMPLE_PLAYERS: ReadonlyArray<ArenaLeaguePlayer> = [
  {
    rank: 1,
    playerName: "Mochi",
    nogName: "Pingu",
    subject: "Networking",
    xp: 640,
  },
  {
    rank: 2,
    playerName: "Bao",
    nogName: "Sproutly",
    subject: "Biology",
    xp: 585,
  },
  {
    rank: 3,
    playerName: "Kiko",
    nogName: "Bloop",
    subject: "Calculus",
    xp: 530,
  },
  {
    rank: 4,
    playerName: "You",
    nogName: "Pip",
    subject: "Networking",
    xp: 470,
    isCurrentUser: true,
  },
  {
    rank: 5,
    playerName: "Taro",
    nogName: "Nori",
    subject: "Chemistry",
    xp: 425,
  },
  {
    rank: 6,
    playerName: "Sora",
    nogName: "Lumi",
    subject: "History",
    xp: 380,
  },
  {
    rank: 7,
    playerName: "Yuzu",
    nogName: "Milo",
    subject: "Physics",
    xp: 340,
  },
  {
    rank: 8,
    playerName: "Pocky",
    nogName: "Bean",
    subject: "Algorithms",
    xp: 295,
  },
] as const;

export const ARENA_BATTLE_STEPS: ReadonlyArray<ArenaBattleStep> = [
  {
    step: 1,
    title: "Pick a topic you've taught",
    detail: "Choose any ready topic from your Nog's notebook.",
  },
  {
    step: 2,
    title: "Your Nogs answer the same hidden questions",
    detail:
      "Every Nog speaks only from the lessons and thought cards in its own notebook.",
  },
  {
    step: 3,
    title: "Best explained notebook wins XP",
    detail:
      "Clear explanations and accurate concepts earn points toward the Weekly League.",
  },
] as const;
