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

export enum LeagueDivision {
    AL_EAST = 'AL East',
    AL_CENTRAL = 'AL Central',
    AL_WEST = 'AL West',
    NL_EAST = 'NL East',
    NL_CENTRAL = 'NL Central',
    NL_WEST = 'NL West',
}

export enum LeagueDivisionFullName {
    AL_EAST = 'American League East',
    AL_CENTRAL = 'American League Central',
    AL_WEST = 'American League West',
    NL_EAST = 'National League East',
    NL_CENTRAL = 'National League Central',
    NL_WEST = 'National League West',
}

export enum LeagueFullName {
    AMERICAN_LEAGUE = 'American League',
    NATIONAL_LEAGUE = 'National League',
}

export enum DivsionFullName {

}

export enum Batting {
    R = 'R',
    L = 'L',
    S = 'S',
}

export enum BattingFullName {
    R = 'Right',
    L = 'Left',
    S = 'Switch',
}

export enum Throwing {
    R = 'R',
    L = 'L',
    B = 'B',
}

export enum ThrowingFullName {
    R = 'Right',
    L = 'Left',
    B = 'Both',
}

export enum CountryBorn {
    USA = 'USA',
    DR = 'D.R.',
    VEN = 'Ven.',
    PR = 'P.R.',
    CUB = 'Cuba',
    CAN = 'Canada',
    MEX = 'Mexico',
    COL = 'Col.',
    KOR = 'Korea',
    JPN = 'Japan',
    PAN = 'Panama',
    AUS = 'Australia',
    BRA = 'Brazil',
    NIC = 'Nicarag.',
    ARU = 'Aruba',
    BAH = 'Bahamas',
    CUR = 'Curacao',
    HON = 'Honduras',
    PER = 'Peru',
    TWN = 'Taiwan',
    GER = 'Germany',
}

export enum CountryBornFullName {
    USA = 'USA',
    DR = 'Dominican Republic',
    VEN = 'Venezuela',
    PR = 'Puerto Rico',
    CUB = 'Cuba',
    CAN = 'Canada',
    MEX = 'Mexico',
    MEX_MEX = 'MEX',
    COL = 'Colombia',
    KOR = 'South Korea',
    ROK = 'Republic of Korea',
    JPN = 'Japan',
    PAN = 'Panama',
    PCZ = 'Panama Canal Zone',
    AUS = 'Australia',
    BRA = 'Brazil',
    NIC = 'Nicaragua',
    ARU = 'Aruba',
    BAH = 'Bahamas',
    CUR = 'Curacao',
    HON = 'Honduras',
    PER = 'Peru',
    TWN = 'Taiwan',
    GER = 'Germany',
}

export enum PositionEnum {
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

export enum PlayerAttr {
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

export enum PlayerAttrColor {
    BLUE = 'blue',
    ORANGE = 'orange',
    NONE = 'none',
}

export interface UiPlayer {
    name: string;
    team: string;
    lgDiv: string;
    b: string;
    t: string;
    born: string;
    age: string;
    pos: string;
    colorMap: Map<PlayerAttr, PlayerAttrColor>;
}

export interface UiPlayerDetailed {
    player: PlayerDetailed;
    team: string;
    division: string;
}

export interface UiRoster {
    team: string;
    division: string;
    players: Player[];
}

export interface UiRosterPlayer {
    player: Player;
    team: string;
    division: string;
}

export interface TeamsResponse {
    copyright: string;
    teams: Team[];
}

export interface Team {
    allStarStatus: string
    id: number
    name: string
    link: string
    season: number
    venue: Venue
    teamCode: string
    fileCode: string
    abbreviation?: string
    teamName: string
    locationName?: string
    firstYearOfPlay?: string
    league: League
    division?: Division
    sport: Sport
    shortName: string
    parentOrgName?: string
    parentOrgId?: number
    franchiseName?: string
    clubName?: string
    active: boolean
    springLeague?: SpringLeague
    springVenue?: SpringVenue
}

export interface Venue {
    id: number
    name?: string
    link: string
}

export interface League {
    id?: number
    name?: string
    link: string
}

export interface Division {
    id: number
    name: string
    link: string
}

export interface Sport {
    id: number
    link: string
    name: string
}

export interface SpringLeague {
    id: number
    name: string
    link: string
    abbreviation: string
}

export interface SpringVenue {
    id: number
    link: string
}

export interface RosterResponse {
    copyright: string
    roster: Player[]
    link: string
    teamId: number
    rosterType: string
}

export interface Player {
    person: Person
    jerseyNumber: string
    position: Position
    status: Status
    parentTeamId: number
}

export interface Person {
    id: number
    fullName: string
    link: string
}

export interface Position {
    code: string
    name: string
    type: string
    abbreviation: string
}

export interface Status {
    code: string
    description: string
}

export interface PlayerResponse {
    copyright: string
    people: PlayerDetailed[]
}

export interface PlayerDetailed {
    id: number
    fullName: string
    link: string
    firstName: string
    lastName: string
    primaryNumber: string
    birthDate: string
    currentAge: number
    birthCity: string
    birthStateProvince: string
    birthCountry: string
    height: string
    weight: number
    active: boolean
    primaryPosition: PrimaryPosition
    useName: string
    useLastName: string
    middleName: string
    boxscoreName: string
    gender: string
    isPlayer: boolean
    isVerified: boolean
    draftYear: number
    batSide: BatSide
    pitchHand: PitchHand
    nameFirstLast: string
    nameSlug: string
    firstLastName: string
    lastFirstName: string
    lastInitName: string
    initLastName: string
    fullFMLName: string
    fullLFMName: string
    strikeZoneTop: number
    strikeZoneBottom: number
}

export interface PrimaryPosition {
    code: string
    name: string
    type: string
    abbreviation: string
}

export interface BatSide {
    code: string
    description: string
}

export interface PitchHand {
    code: string
    description: string
}