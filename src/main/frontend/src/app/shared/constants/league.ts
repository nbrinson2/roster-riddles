import { NflTeam, NflLeagueDivision } from "../enumeration/nfl-enums";
import { LeagueType } from "../models/models";

export const LeagueTypeIdMap = {
  [LeagueType.MLB]: 1,
  [LeagueType.NFL]: 2,
};

export const nflTeamToDivisionMap: { [key in NflTeam]: NflLeagueDivision } = {
    [NflTeam.ARI]: NflLeagueDivision.NFC_WEST,
    [NflTeam.ATL]: NflLeagueDivision.NFC_SOUTH,
    [NflTeam.BAL]: NflLeagueDivision.AFC_NORTH,
    [NflTeam.BUF]: NflLeagueDivision.AFC_EAST,
    [NflTeam.CAR]: NflLeagueDivision.NFC_SOUTH,
    [NflTeam.CHI]: NflLeagueDivision.NFC_NORTH,
    [NflTeam.CIN]: NflLeagueDivision.AFC_NORTH,
    [NflTeam.CLE]: NflLeagueDivision.AFC_NORTH,
    [NflTeam.DAL]: NflLeagueDivision.NFC_EAST,
    [NflTeam.DEN]: NflLeagueDivision.AFC_WEST,
    [NflTeam.DET]: NflLeagueDivision.NFC_NORTH,
    [NflTeam.GB]: NflLeagueDivision.NFC_NORTH,
    [NflTeam.HOU]: NflLeagueDivision.AFC_SOUTH,
    [NflTeam.IND]: NflLeagueDivision.AFC_SOUTH,
    [NflTeam.JAX]: NflLeagueDivision.AFC_SOUTH,
    [NflTeam.KC]: NflLeagueDivision.AFC_WEST,
    [NflTeam.LV]: NflLeagueDivision.AFC_WEST,
    [NflTeam.LAC]: NflLeagueDivision.AFC_WEST,
    [NflTeam.LAR]: NflLeagueDivision.NFC_WEST,
    [NflTeam.MIA]: NflLeagueDivision.AFC_EAST,
    [NflTeam.MIN]: NflLeagueDivision.NFC_NORTH,
    [NflTeam.NE]: NflLeagueDivision.AFC_EAST,
    [NflTeam.NO]: NflLeagueDivision.NFC_SOUTH,
    [NflTeam.NYG]: NflLeagueDivision.NFC_EAST,
    [NflTeam.NYJ]: NflLeagueDivision.AFC_EAST,
    [NflTeam.PHI]: NflLeagueDivision.NFC_EAST,
    [NflTeam.PIT]: NflLeagueDivision.AFC_NORTH,
    [NflTeam.SF]: NflLeagueDivision.NFC_WEST,
    [NflTeam.SEA]: NflLeagueDivision.NFC_WEST,
    [NflTeam.TB]: NflLeagueDivision.NFC_SOUTH,
    [NflTeam.TEN]: NflLeagueDivision.AFC_SOUTH,
    [NflTeam.WSH]: NflLeagueDivision.NFC_EAST,
  };
  