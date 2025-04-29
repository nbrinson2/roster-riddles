import { MlbBatting, MlbBattingFullName, MlbLeagueDivision, MlbLeagueDivisionFullName, MlbTeam, MlbTeamFullName, MlbThrowing, MlbThrowingFullName } from "../models/mlb-models";
import { CountryBornFullName, TeamType } from "../models/models";
import { CountryBorn } from "../models/models";
import { NflTeamFullName } from "../models/nfl-models";
import { NflTeam } from "../models/nfl-models";

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

export const LeagueDivisionAbbreviationMap: { [key in MlbLeagueDivisionFullName]: MlbLeagueDivision } = {
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

export const CountryBornAbbreviationMap: { [key in CountryBornFullName]: CountryBorn } = {
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
    [CountryBornFullName.PCZ]: CountryBorn.PAN
}

export const MlbAbbreviationToFullNameMap: { [key in MlbTeam]: MlbTeamFullName } = {
  [MlbTeam.ARI]: MlbTeamFullName.ARIZONA_DIAMONDBACKS,
  [MlbTeam.ATL]: MlbTeamFullName.ATLANTA_BRAVES,
  [MlbTeam.BAL]: MlbTeamFullName.BALTIMORE_ORIOLES,
  [MlbTeam.BOS]: MlbTeamFullName.BOSTON_RED_SOX,
  [MlbTeam.CHC]: MlbTeamFullName.CHICAGO_CUBS,
  [MlbTeam.CHW]: MlbTeamFullName.CHICAGO_WHITE_SOX,
  [MlbTeam.CIN]: MlbTeamFullName.CINCINNATI_REDS,
  [MlbTeam.CLE]: MlbTeamFullName.CLEVELAND_GUARDIANS,
  [MlbTeam.COL]: MlbTeamFullName.COLORADO_ROCKIES,
  [MlbTeam.DET]: MlbTeamFullName.DETROIT_TIGERS,
  [MlbTeam.HOU]: MlbTeamFullName.HOUSTON_ASTROS,
  [MlbTeam.KCR]: MlbTeamFullName.KANSAS_CITY_ROYALS,
  [MlbTeam.LAA]: MlbTeamFullName.LOS_ANGELES_ANGELS,
  [MlbTeam.LAD]: MlbTeamFullName.LOS_ANGELES_DODGERS,
  [MlbTeam.MIA]: MlbTeamFullName.MIAMI_MARLINS,
  [MlbTeam.MIL]: MlbTeamFullName.MILWAUKEE_BREWERS,
  [MlbTeam.MIN]: MlbTeamFullName.MINNESOTA_TWINS,
  [MlbTeam.NYM]: MlbTeamFullName.NEW_YORK_METS,
  [MlbTeam.NYY]: MlbTeamFullName.NEW_YORK_YANKEES,
  [MlbTeam.OAK]: MlbTeamFullName.OAKLAND_ATHLETICS,
  [MlbTeam.PHI]: MlbTeamFullName.PHILADELPHIA_PHILLIES,
  [MlbTeam.PIT]: MlbTeamFullName.PITTSBURGH_PIRATES,
  [MlbTeam.SDP]: MlbTeamFullName.SAN_DIEGO_PADRES,
  [MlbTeam.SFG]: MlbTeamFullName.SAN_FRANCISCO_GIANTS,
  [MlbTeam.SEA]: MlbTeamFullName.SEATTLE_MARINERS,
  [MlbTeam.STL]: MlbTeamFullName.ST_LOUIS_CARDINALS,
  [MlbTeam.TBR]: MlbTeamFullName.TAMPA_BAY_RAYS,
  [MlbTeam.TEX]: MlbTeamFullName.TEXAS_RANGERS,
  [MlbTeam.TOR]: MlbTeamFullName.TORONTO_BLUE_JAYS,
  [MlbTeam.WSN]: MlbTeamFullName.WASHINGTON_NATIONALS,
};

export const NflAbbreviationToFullNameMap: { [key in NflTeam]: NflTeamFullName } = {
  [NflTeam.ARI]: NflTeamFullName.ARIZONA_CARDINALS,
  [NflTeam.ATL]: NflTeamFullName.ATLANTA_FALCONS,
  [NflTeam.BAL]: NflTeamFullName.BALTIMORE_RAVENS,
  [NflTeam.BUF]: NflTeamFullName.BUFFALO_BILLS,
  [NflTeam.CAR]: NflTeamFullName.CAROLINA_PANTHERS,
  [NflTeam.CHI]: NflTeamFullName.CHICAGO_BEARS,
  [NflTeam.CIN]: NflTeamFullName.CINCINNATI_BENGALS,
  [NflTeam.CLE]: NflTeamFullName.CLEVELAND_BROWNS,
  [NflTeam.DAL]: NflTeamFullName.DALLAS_COWBOYS,
  [NflTeam.DEN]: NflTeamFullName.DENVER_BRONCOS,
  [NflTeam.DET]: NflTeamFullName.DETROIT_LIONS,
  [NflTeam.GB]: NflTeamFullName.GREEN_BAY_PACKERS,
  [NflTeam.HOU]: NflTeamFullName.HOUSTON_TEXANS,
  [NflTeam.IND]: NflTeamFullName.INDIANAPOLIS_COLTS,
  [NflTeam.JAX]: NflTeamFullName.JACKSONVILLE_JAGUARS,
  [NflTeam.KC]: NflTeamFullName.KANSAS_CITY_CHIEFS,
  [NflTeam.LA]: NflTeamFullName.LOS_ANGELES_CHARGERS,
  [NflTeam.MIA]: NflTeamFullName.MIAMI_DOLPHINS,
  [NflTeam.MIN]: NflTeamFullName.MINNESOTA_VIKINGS,
  [NflTeam.NE]: NflTeamFullName.NEW_ENGLAND_PATRIOTS,
  [NflTeam.NO]: NflTeamFullName.NEW_ORLEANS_SAINTS,
  [NflTeam.NYG]: NflTeamFullName.NEW_YORK_GIANTS,
  [NflTeam.NYJ]: NflTeamFullName.NEW_YORK_JETS,
  [NflTeam.PHI]: NflTeamFullName.PHILADELPHIA_EAGLES,
  [NflTeam.PIT]: NflTeamFullName.PITTSBURGH_STEELERS,
  [NflTeam.SEA]: NflTeamFullName.SEATTLE_SEAHAWKS,
  [NflTeam.SF]: NflTeamFullName.SAN_FRANCISCO_49ERS,
  [NflTeam.TB]: NflTeamFullName.TAMPA_BAY_BUCCANEERS,
  [NflTeam.TEN]: NflTeamFullName.TENNESSEE_TITANS,
  [NflTeam.WAS]: NflTeamFullName.WASHINGTON_COMMANDERS,
};

export const TeamAbbreviationToFullNameMap: { [key in TeamType]: string } = {
  ...MlbAbbreviationToFullNameMap,
  ...NflAbbreviationToFullNameMap
};
