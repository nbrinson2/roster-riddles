import { CountryBorn, PlayerAttrColor, UiPlayer } from './models';

export enum MlbTeam {
  ARI = 'ARI', // Arizona Diamondbacks
  ATL = 'ATL', // Atlanta Braves
  BAL = 'BAL', // Baltimore Orioles
  BOS = 'BOS', // Boston Red Sox
  CHC = 'CHC', // Chicago Cubs
  CHW = 'CHW', // Chicago White Sox
  CIN = 'CIN', // Cincinnati Reds
  CLE = 'CLE', // Cleveland Guardians
  COL = 'COL', // Colorado Rockies
  DET = 'DET', // Detroit Tigers
  HOU = 'HOU', // Houston Astros
  KCR = 'KCR', // Kansas City Royals
  LAA = 'LAA', // Los Angeles Angels
  LAD = 'LAD', // Los Angeles Dodgers
  MIA = 'MIA', // Miami Marlins
  MIL = 'MIL', // Milwaukee Brewers
  MIN = 'MIN', // Minnesota Twins
  NYM = 'NYM', // New York Mets
  NYY = 'NYY', // New York Yankees
  OAK = 'OAK', // Oakland Athletics
  PHI = 'PHI', // Philadelphia Phillies
  PIT = 'PIT', // Pittsburgh Pirates
  SDP = 'SDP', // San Diego Padres
  SFG = 'SFG', // San Francisco Giants
  SEA = 'SEA', // Seattle Mariners
  STL = 'STL', // St. Louis Cardinals
  TBR = 'TBR', // Tampa Bay Rays
  TEX = 'TEX', // Texas Rangers
  TOR = 'TOR', // Toronto Blue Jays
  WSN = 'WSN', // Washington Nationals
}

export enum MlbTeamFullName {
  ARIZONA_DIAMONDBACKS = 'Arizona Diamondbacks',
  ATLANTA_BRAVES = 'Atlanta Braves',
  BALTIMORE_ORIOLES = 'Baltimore Orioles',
  BOSTON_RED_SOX = 'Boston Red Sox',
  CHICAGO_CUBS = 'Chicago Cubs',
  CHICAGO_WHITE_SOX = 'Chicago White Sox',
  CINCINNATI_REDS = 'Cincinnati Reds',
  CLEVELAND_GUARDIANS = 'Cleveland Guardians',
  COLORADO_ROCKIES = 'Colorado Rockies',
  DETROIT_TIGERS = 'Detroit Tigers',
  HOUSTON_ASTROS = 'Houston Astros',
  KANSAS_CITY_ROYALS = 'Kansas City Royals',
  LOS_ANGELES_ANGELS = 'Los Angeles Angels',
  LOS_ANGELES_DODGERS = 'Los Angeles Dodgers',
  MIAMI_MARLINS = 'Miami Marlins',
  MILWAUKEE_BREWERS = 'Milwaukee Brewers',
  MINNESOTA_TWINS = 'Minnesota Twins',
  NEW_YORK_METS = 'New York Mets',
  NEW_YORK_YANKEES = 'New York Yankees',
  OAKLAND_ATHLETICS = 'Oakland Athletics',
  PHILADELPHIA_PHILLIES = 'Philadelphia Phillies',
  PITTSBURGH_PIRATES = 'Pittsburgh Pirates',
  SAN_DIEGO_PADRES = 'San Diego Padres',
  SAN_FRANCISCO_GIANTS = 'San Francisco Giants',
  SEATTLE_MARINERS = 'Seattle Mariners',
  ST_LOUIS_CARDINALS = 'St. Louis Cardinals',
  TAMPA_BAY_RAYS = 'Tampa Bay Rays',
  TEXAS_RANGERS = 'Texas Rangers',
  TORONTO_BLUE_JAYS = 'Toronto Blue Jays',
  WASHINGTON_NATIONALS = 'Washington Nationals',
}

export enum MlbLeagueDivision {
  AL_EAST = 'AL East',
  AL_CENTRAL = 'AL Central',
  AL_WEST = 'AL West',
  NL_EAST = 'NL East',
  NL_CENTRAL = 'NL Central',
  NL_WEST = 'NL West',
}

export enum MlbLeagueDivisionFullName {
  AL_EAST = 'American League East',
  AL_CENTRAL = 'American League Central',
  AL_WEST = 'American League West',
  NL_EAST = 'National League East',
  NL_CENTRAL = 'National League Central',
  NL_WEST = 'National League West',
}

export enum MlbBatting {
  R = 'R',
  L = 'L',
  S = 'S',
}

export enum MlbBattingFullName {
  R = 'Right',
  L = 'Left',
  S = 'Switch',
}

export enum MlbThrowing {
  R = 'R',
  L = 'L',
  B = 'B',
}

export enum MlbThrowingFullName {
  R = 'Right',
  L = 'Left',
  B = 'Both',
}

export enum MlbPositionEnum {
  SP = 'SP',
  RP = 'RP',
  P = 'P',
  C = 'C',
  FB = '1B',
  SB = '2B',
  TB = '3B',
  SS = 'SS',
  LF = 'LF',
  CF = 'CF',
  RF = 'RF',
  DH = 'DH',
  TWP = 'TWP',
}

export enum MlbPlayerAttributes {
  NAME = 'name',
  TEAM = 'team',
  LG_DIV = 'lgDiv',
  B = 'b',
  T = 't',
  BORN = 'born',
  AGE = 'age',
  POS = 'pos',
  COLOR_MAP = 'colorMap',
}

export interface MlbUiPlayer extends UiPlayer<MlbPlayerAttributes> {
  team: MlbTeam;
  lgDiv: MlbLeagueDivision;
  b: MlbBatting;
  t: MlbThrowing;
  born: CountryBorn;
  pos: MlbPositionEnum;
}

export interface MlbUiPlayerDetailed {
  player: MlbPlayerDetailed;
  team: MlbTeam;
  division: string;
}

export interface MlbUiRoster {
  team: string;
  division: string;
  players: MlbPlayer[];
}

export interface MlbUiRosterPlayer {
  player: MlbPlayer;
  team: string;
  division: string;
}

export interface MlbTeamsResponse {
  copyright: string;
  teams: MlbTeamDetails[];
}

export interface MlbTeamDetails {
  allStarStatus: string;
  id: number;
  name: string;
  link: string;
  season: number;
  venue: MlbVenue;
  teamCode: string;
  fileCode: string;
  abbreviation?: string;
  teamName: string;
  locationName?: string;
  firstYearOfPlay?: string;
  league: MlbLeagueDetails;
  division?: MlbDivisionDetails;
  sport: MlbSportDetails;
  shortName: string;
  parentOrgName?: string;
  parentOrgId?: number;
  franchiseName?: string;
  clubName?: string;
  active: boolean;
  springLeague?: MlbSpringLeague;
  springVenue?: MlbSpringVenue;
}

export interface MlbVenue {
  id: number;
  name?: string;
  link: string;
}

export interface MlbLeagueDetails {
  id?: number;
  name?: string;
  link: string;
}

export interface MlbDivisionDetails {
  id: number;
  name: string;
  link: string;
}

export interface MlbSportDetails {
  id: number;
  link: string;
  name: string;
}

export interface MlbSpringLeague {
  id: number;
  name: string;
  link: string;
  abbreviation: string;
}

export interface MlbSpringVenue {
  id: number;
  link: string;
}

export interface MlbRosterResponse {
  copyright: string;
  roster: MlbPlayer[];
  link: string;
  teamId: number;
  rosterType: string;
}

export interface MlbPlayer {
  person: MlbPerson;
  jerseyNumber: string;
  position: MlbPosition;
  status: MlbPlayerStatus;
  parentTeamId: number;
}

export interface MlbPerson {
  id: number;
  fullName: string;
  link: string;
}

export interface MlbPosition {
  code: string;
  name: string;
  type: string;
  abbreviation: string;
}

export interface MlbPlayerStatus {
  code: string;
  description: string;
}

export interface MlbPlayerResponse {
  copyright: string;
  people: MlbPlayerDetailed[];
}

export interface MlbPlayerDetailed {
  id: number;
  fullName: string;
  link: string;
  firstName: string;
  lastName: string;
  primaryNumber: string;
  birthDate: string;
  currentAge: number;
  birthCity: string;
  birthStateProvince: string;
  birthCountry: string;
  height: string;
  weight: number;
  active: boolean;
  primaryPosition: MlbPrimaryPosition;
  useName: string;
  useLastName: string;
  middleName: string;
  boxscoreName: string;
  gender: string;
  isPlayer: boolean;
  isVerified: boolean;
  draftYear: number;
  batSide: MlbBatSide;
  pitchHand: MlbPitchHand;
  nameFirstLast: string;
  nameSlug: string;
  firstLastName: string;
  lastFirstName: string;
  lastInitName: string;
  initLastName: string;
  fullFMLName: string;
  fullLFMName: string;
  strikeZoneTop: number;
  strikeZoneBottom: number;
}

export interface MlbPrimaryPosition {
  code: string;
  name: string;
  type: string;
  abbreviation: MlbPositionEnum;
}

export interface MlbBatSide {
  code: string;
  description: string;
}

export interface MlbPitchHand {
  code: string;
  description: string;
}
