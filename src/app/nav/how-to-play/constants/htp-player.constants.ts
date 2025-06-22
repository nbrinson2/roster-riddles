import {
  MlbBatting,
  MlbLeagueDivision,
  MlbPlayerAttributes,
  MlbTeam,
  MlbPositionEnum,
  MlbThrowing,
  MlbUiPlayer,
  MlbTeamKey,
  MlbTeamFullName,
} from '../../../game/bio-ball/models/mlb.models';
import { PlayerAttrColor } from 'src/app/shared/models/common-models';
import { CountryBorn } from '../../../game/bio-ball/models/bio-ball.models';
import { CareerPathPlayer } from 'src/app/game/career-path/models/career-path.models';
import { Header } from 'src/app/game/shared/common-attribute-header/common-attribute-header.component';

export const BIO_BALL_PLAYERS: MlbUiPlayer[] = [
  {
    name: 'Johnny Player',
    team: MlbTeam.CHW,
    lgDiv: MlbLeagueDivision.AL_EAST,
    b: MlbBatting.R,
    t: MlbThrowing.L,
    born: CountryBorn.VEN,
    age: '33',
    pos: MlbPositionEnum.C,
    colorMap: new Map<MlbPlayerAttributes, PlayerAttrColor>([
      [MlbPlayerAttributes.B, PlayerAttrColor.BLUE],
      [MlbPlayerAttributes.T, PlayerAttrColor.BLUE],
      [MlbPlayerAttributes.POS, PlayerAttrColor.BLUE],
    ]),
  },
  {
    name: 'Johnny Player',
    team: MlbTeam.CHW,
    lgDiv: MlbLeagueDivision.AL_EAST,
    b: MlbBatting.R,
    t: MlbThrowing.L,
    born: CountryBorn.VEN,
    age: '33',
    pos: MlbPositionEnum.C,
    colorMap: new Map<MlbPlayerAttributes, PlayerAttrColor>([
      [MlbPlayerAttributes.LG_DIV, PlayerAttrColor.ORANGE],
    ]),
  },
  {
    name: 'Johnny Player',
    team: MlbTeam.CHW,
    lgDiv: MlbLeagueDivision.AL_EAST,
    b: MlbBatting.R,
    t: MlbThrowing.L,
    born: CountryBorn.VEN,
    age: '33',
    pos: MlbPositionEnum.C,
    colorMap: new Map<MlbPlayerAttributes, PlayerAttrColor>([
      [MlbPlayerAttributes.AGE, PlayerAttrColor.ORANGE],
    ]),
  },
  {
    name: 'Johnny Player',
    team: MlbTeam.CHW,
    lgDiv: MlbLeagueDivision.AL_EAST,
    b: MlbBatting.R,
    t: MlbThrowing.L,
    born: CountryBorn.VEN,
    age: '33',
    pos: MlbPositionEnum.C,
    colorMap: new Map<MlbPlayerAttributes, PlayerAttrColor>([
      [MlbPlayerAttributes.TEAM, PlayerAttrColor.BLUE],
    ]),
  },
];

export const CAREER_PATH_PLAYERS: CareerPathPlayer[] = [
  {
    id: 1,
    name: 'Johnny Player',
    groups: [
      {
        from: 2000,
        to: 2003,
        stints: [
          {
            teamKey: MlbTeamKey.NEW_YORK_YANKEES,
            teamFullName: MlbTeamFullName.NEW_YORK_YANKEES,
            teamAbbreviation: MlbTeam.NYY,
            from: 2000,
            to: 2003,
            logoBorderColor: PlayerAttrColor.BLUE,
            yearColor: PlayerAttrColor.NONE,
          },
        ],
      },
      {
        from: 2004,
        to: 2005,
        stints: [
          {
            teamKey: MlbTeamKey.CHICAGO_CUBS,
            teamFullName: MlbTeamFullName.CHICAGO_CUBS,
            teamAbbreviation: MlbTeam.CHC,
            from: 2004,
            to: 2005,
            logoBorderColor: PlayerAttrColor.NONE,
            yearColor: PlayerAttrColor.NONE,
          },
        ]
      }
    ],
  },

  {
    id: 2,
    name: 'Johnny Player',
    groups: [
      {
        from: 1990,
        to: 1995,
        stints: [
          {
            teamKey: MlbTeamKey.BOSTON_RED_SOX,
            teamFullName: MlbTeamFullName.BOSTON_RED_SOX,
            teamAbbreviation: MlbTeam.BOS,
            from: 1990,
            to: 1995,
            logoBorderColor: PlayerAttrColor.ORANGE,
            yearColor: PlayerAttrColor.NONE,
          },
        ],
      },
      {
        from: 1996,
        to: 1997,
        stints: [
          {
            teamKey: MlbTeamKey.OAKLAND_ATHLETICS,
            teamFullName: MlbTeamFullName.OAKLAND_ATHLETICS,
            teamAbbreviation: MlbTeam.OAK,
            from: 1996,
            to: 1997,
            logoBorderColor: PlayerAttrColor.NONE,
            yearColor: PlayerAttrColor.NONE,
          },
        ],
      },
    ],
  },

  {
    id: 3,
    name: 'Johnny Player',
    groups: [
      {
        from: 2002,
        to: 2003,
        stints: [
          {
            teamKey: MlbTeamKey.LOS_ANGELES_DODGERS,
            teamFullName: MlbTeamFullName.LOS_ANGELES_DODGERS,
            teamAbbreviation: MlbTeam.LAD,
            from: 2002,
            to: 2003,
            logoBorderColor: PlayerAttrColor.NONE,
            yearColor: PlayerAttrColor.BLUE,
          },
        ],
      },
      {
        from: 2004,
        to: 2005,
        stints: [
          {
            teamKey: MlbTeamKey.HOUSTON_ASTROS,
            teamFullName: MlbTeamFullName.HOUSTON_ASTROS,
            teamAbbreviation: MlbTeam.HOU,
            from: 2004,
            to: 2005,
            logoBorderColor: PlayerAttrColor.NONE,
            yearColor: PlayerAttrColor.NONE,
          },
        ],
      },
    ],
  },

  {
    id: 4,
    name: 'Johnny Player',
    groups: [
      {
        from: 2004,
        to: 2007,
        stints: [
          {
            teamKey: MlbTeamKey.CINCINNATI_REDS,
            teamFullName: MlbTeamFullName.CINCINNATI_REDS,
            teamAbbreviation: MlbTeam.CIN,
            from: 2004,
            to: 2007,
            logoBorderColor: PlayerAttrColor.NONE,
            yearColor: PlayerAttrColor.ORANGE,
          },
        ],
      },
      {
        from: 2008,
        to: 2011,
        stints: [
          {
            teamKey: MlbTeamKey.TEXAS_RANGERS,
            teamFullName: MlbTeamFullName.TEXAS_RANGERS,
            teamAbbreviation: MlbTeam.TEX,
            from: 2008,
            to: 2011,
            logoBorderColor: PlayerAttrColor.NONE,
            yearColor: PlayerAttrColor.NONE,
          },
        ],
      },
    ],
  },

  {
    id: 5,
    name: 'Johnny Player',
    groups: [
      {
        from: 2010,
        to: 2015,
        stints: [
          {
            teamKey: MlbTeamKey.KANSAS_CITY_ROYALS,
            teamFullName: MlbTeamFullName.KANSAS_CITY_ROYALS,
            teamAbbreviation: MlbTeam.KCR,
            from: 2010,
            to: 2015,
            logoBorderColor: PlayerAttrColor.BLUE,
            yearColor: PlayerAttrColor.NONE,
          },
        ],
      },
      {
        from: 2016,
        to: 2017,
        stints: [
          {
            teamKey: MlbTeamKey.MIAMI_MARLINS,
            teamFullName: MlbTeamFullName.MIAMI_MARLINS,
            teamAbbreviation: MlbTeam.MIA,
            from: 2016,
            to: 2017,
            logoBorderColor: PlayerAttrColor.NONE,
            yearColor: PlayerAttrColor.NONE,
          },
        ],
      },
    ],
  },
  {
    id: 6,
    name: '???',
    groups: [
      {
        from: 2000,
        to: 2003,
        stints: [
          {
            teamKey: MlbTeamKey.PHILADELPHIA_PHILLIES,
            teamFullName: MlbTeamFullName.PHILADELPHIA_PHILLIES,
            teamAbbreviation: MlbTeam.PHI,
            from: 2000,
            to: 2003,
            logoBorderColor: PlayerAttrColor.NONE,
            yearColor: PlayerAttrColor.NONE,
          },
        ],
      },
      {
        from: 2004,
        to: 2005,
        stints: [
          {
            teamKey: MlbTeamKey.ARIZONA_DIAMONDBACKS,
            teamFullName: MlbTeamFullName.ARIZONA_DIAMONDBACKS,
            teamAbbreviation: MlbTeam.ARI,
            from: 2004,
            to: 2005,
            logoBorderColor: PlayerAttrColor.NONE,
            yearColor: PlayerAttrColor.NONE,
          },
        ],
      },
    ],
  },
];

export const CAREER_PATH_ATTRIBUTE_HEADERS: Header[] = [
  {
    name: 'Drafted',
    value: '2000',
    colSpan: 1,
    class: 'bats-throws',
  },
  {
    name: 'Bats/Throws',
    value: 'R/L',
    colSpan: 1,
    class: 'bats-throws',
  },
  {
    name: 'Born',
    value: 'USA',
    colSpan: 1,
    class: 'bats-throws',
  },
  {
    name: '#',
    value: '13',
    colSpan: 1,
    class: 'bats-throws',
  },
  {
    name: 'Pos',
    value: 'C',
    colSpan: 1,
    class: 'bats-throws',
  },
];
