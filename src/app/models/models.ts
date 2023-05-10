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



export enum LeagueDivision {
    AL_EAST = 'AL East',
    AL_CENTRAL = 'AL Central',
    AL_WEST = 'AL West',
    NL_EAST = 'NL East',
    NL_CENTRAL = 'NL Central',
    NL_WEST = 'NL West',
}

export enum Batting {
    R = 'R',
    L = 'L',
    S = 'S',
}

export enum Throwing {
    R = 'R',
    L = 'L',
    B = 'B',
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

export enum Position {
    SP = 'SP',
    RP = 'RP',
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
    GREEN = 'green',
    YELLOW = 'yellow',
    NONE = 'none',
}
