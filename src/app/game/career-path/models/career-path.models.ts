import { PlayerAttrColor } from "src/app/shared/models/common-models";

export interface CareerPathPlayerResponse {
  id: number;
  name: string;
  teams: CareerPathTeam[];
}

export interface CareerPathTeam {
  team: string;
  yearStart: number;
  yearEnd: number;
}

export interface TeamStint {
  teamKey: string;
  from: number;
  to: number;
  logoBorderColor: PlayerAttrColor;
  yearColor: PlayerAttrColor;
}

/** A cluster of one-or-more TeamStints sharing the exact same from/to */
export interface TimelineGroup {
  from:   number;
  to:     number;
  stints: TeamStint[];
}

export interface CareerPathPlayer {
  id: number;
  name: string;
  groups: TimelineGroup[];
}
