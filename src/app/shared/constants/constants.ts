import { Batting, BattingFullName, CountryBorn, CountryBornFullName, LeagueDivision, LeagueDivisionFullName, MlbTeam, MlbTeamFullName, Throwing, ThrowingFullName } from "../models/models";

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

export const LeagueDivisionAbbreviationMap: { [key in LeagueDivisionFullName]: LeagueDivision } = {
    [LeagueDivisionFullName.AL_EAST]: LeagueDivision.AL_EAST,
    [LeagueDivisionFullName.AL_WEST]: LeagueDivision.AL_WEST,
    [LeagueDivisionFullName.AL_CENTRAL]: LeagueDivision.AL_CENTRAL,
    [LeagueDivisionFullName.NL_EAST]: LeagueDivision.NL_EAST,
    [LeagueDivisionFullName.NL_WEST]: LeagueDivision.NL_WEST,
    [LeagueDivisionFullName.NL_CENTRAL]: LeagueDivision.NL_CENTRAL,
};

export const BattingAbbreviationMap: { [key in BattingFullName]: Batting } = {
    [BattingFullName.R]: Batting.R,
    [BattingFullName.L]: Batting.L,
    [BattingFullName.S]: Batting.S,
};

export const ThrowingAbbreviationMap: { [key in ThrowingFullName]: Throwing } = {
    [ThrowingFullName.R]: Throwing.R,
    [ThrowingFullName.L]: Throwing.L,
    [ThrowingFullName.B]: Throwing.B,
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