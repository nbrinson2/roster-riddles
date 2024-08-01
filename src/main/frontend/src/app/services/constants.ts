import {
  MlbBatting,
  MlbBattingFullName,
  CountryBorn,
  CountryBornFullName,
  MlbLeagueDivision,
  MlbLeagueDivisionFullName,
  MlbTeam,
  MlbTeamFullName,
  MlbThrowing,
  MlbThrowingFullName,
} from '../shared/models/mlb-models';
import { LeagueType } from '../shared/models/models';

export const MlbTeamAbbreviationMap: { [key in MlbTeamFullName]: MlbTeam } = {
  [MlbTeamFullName.ARIZONA_DIAMONDBACKS]: MlbTeam.ARI,
  [MlbTeamFullName.ATLANTA_BRAVES]: MlbTeam.ATL,
  [MlbTeamFullName.BALTIMORE_ORIOLES]: MlbTeam.BAL,
  [MlbTeamFullName.BOSTON_RED_SOX]: MlbTeam.BOS,
  [MlbTeamFullName.CHICAGO_CUBS]: MlbTeam.CHC,
  [MlbTeamFullName.CHICAGO_WHITE_SOX]: MlbTeam.CHW,
  [MlbTeamFullName.CINCINNATI_REDS]: MlbTeam.CIN,
  [MlbTeamFullName.CLEVELAND_GUARDIANS]: MlbTeam.CLE,
  [MlbTeamFullName.COLORADO_ROCKIES]: MlbTeam.COL,
  [MlbTeamFullName.DETROIT_TIGERS]: MlbTeam.DET,
  [MlbTeamFullName.HOUSTON_ASTROS]: MlbTeam.HOU,
  [MlbTeamFullName.KANSAS_CITY_ROYALS]: MlbTeam.KCR,
  [MlbTeamFullName.LOS_ANGELES_ANGELS]: MlbTeam.LAA,
  [MlbTeamFullName.LOS_ANGELES_DODGERS]: MlbTeam.LAD,
  [MlbTeamFullName.MIAMI_MARLINS]: MlbTeam.MIA,
  [MlbTeamFullName.MILWAUKEE_BREWERS]: MlbTeam.MIL,
  [MlbTeamFullName.MINNESOTA_TWINS]: MlbTeam.MIN,
  [MlbTeamFullName.NEW_YORK_METS]: MlbTeam.NYM,
  [MlbTeamFullName.NEW_YORK_YANKEES]: MlbTeam.NYY,
  [MlbTeamFullName.OAKLAND_ATHLETICS]: MlbTeam.OAK,
  [MlbTeamFullName.PHILADELPHIA_PHILLIES]: MlbTeam.PHI,
  [MlbTeamFullName.PITTSBURGH_PIRATES]: MlbTeam.PIT,
  [MlbTeamFullName.SAN_DIEGO_PADRES]: MlbTeam.SDP,
  [MlbTeamFullName.SAN_FRANCISCO_GIANTS]: MlbTeam.SFG,
  [MlbTeamFullName.SEATTLE_MARINERS]: MlbTeam.SEA,
  [MlbTeamFullName.ST_LOUIS_CARDINALS]: MlbTeam.STL,
  [MlbTeamFullName.TAMPA_BAY_RAYS]: MlbTeam.TBR,
  [MlbTeamFullName.TEXAS_RANGERS]: MlbTeam.TEX,
  [MlbTeamFullName.TORONTO_BLUE_JAYS]: MlbTeam.TOR,
  [MlbTeamFullName.WASHINGTON_NATIONALS]: MlbTeam.WSN,
};

export const LeagueDivisionAbbreviationMap: {
  [key in MlbLeagueDivisionFullName]: MlbLeagueDivision;
} = {
  [MlbLeagueDivisionFullName.AL_EAST]: MlbLeagueDivision.AL_EAST,
  [MlbLeagueDivisionFullName.AL_WEST]: MlbLeagueDivision.AL_WEST,
  [MlbLeagueDivisionFullName.AL_CENTRAL]: MlbLeagueDivision.AL_CENTRAL,
  [MlbLeagueDivisionFullName.NL_EAST]: MlbLeagueDivision.NL_EAST,
  [MlbLeagueDivisionFullName.NL_WEST]: MlbLeagueDivision.NL_WEST,
  [MlbLeagueDivisionFullName.NL_CENTRAL]: MlbLeagueDivision.NL_CENTRAL,
};

export const BattingAbbreviationMap: { [key in MlbBattingFullName]: MlbBatting } = {
  [MlbBattingFullName.R]: MlbBatting.R,
  [MlbBattingFullName.L]: MlbBatting.L,
  [MlbBattingFullName.S]: MlbBatting.S,
};

export const ThrowingAbbreviationMap: { [key in MlbThrowingFullName]: MlbThrowing } = {
  [MlbThrowingFullName.R]: MlbThrowing.R,
  [MlbThrowingFullName.L]: MlbThrowing.L,
  [MlbThrowingFullName.B]: MlbThrowing.B,
};

export const CountryBornAbbreviationMap: {
  [key in CountryBornFullName]: CountryBorn;
} = {
  [CountryBornFullName.USA]: CountryBorn.USA,
  [CountryBornFullName.DR]: CountryBorn.DR,
  [CountryBornFullName.VEN]: CountryBorn.VEN,
  [CountryBornFullName.PR]: CountryBorn.PR,
  [CountryBornFullName.CUB]: CountryBorn.CUB,
  [CountryBornFullName.CAN]: CountryBorn.CAN,
  [CountryBornFullName.MEX]: CountryBorn.MEX,
  [CountryBornFullName.COL]: CountryBorn.COL,
  [CountryBornFullName.KOR]: CountryBorn.KOR,
  [CountryBornFullName.JPN]: CountryBorn.JPN,
  [CountryBornFullName.PAN]: CountryBorn.PAN,
  [CountryBornFullName.AUS]: CountryBorn.AUS,
  [CountryBornFullName.BRA]: CountryBorn.BRA,
  [CountryBornFullName.NIC]: CountryBorn.NIC,
  [CountryBornFullName.ARU]: CountryBorn.ARU,
  [CountryBornFullName.BAH]: CountryBorn.BAH,
  [CountryBornFullName.CUR]: CountryBorn.CUR,
  [CountryBornFullName.HON]: CountryBorn.HON,
  [CountryBornFullName.PER]: CountryBorn.PER,
  [CountryBornFullName.TWN]: CountryBorn.TWN,
  [CountryBornFullName.GER]: CountryBorn.GER,
  [CountryBornFullName.MEX_MEX]: CountryBorn.MEX,
  [CountryBornFullName.ROK]: CountryBorn.KOR,
  [CountryBornFullName.PCZ]: CountryBorn.PAN,
};

export const LeagueTypeIdMap: { [key in LeagueType]: number } = {
  [LeagueType.MLB]: 1,
  [LeagueType.NHL]: 4,
  [LeagueType.NBA]: 3,
  [LeagueType.NFL]: 2,
};

export enum EndResultMessage {
  WIN = "You ol' sandbagger, you beat the game!!",
  LOSE = 'Just give up, you DO NOT know baseball.',
}

export enum InputPlaceHolderText {
  GUESS = 'Guess the mystery player',
  COUNT = 'guesses remaining',
  WIN = 'You guessed correctly!',
  LOSE = 'Go home, you lose.',
}
