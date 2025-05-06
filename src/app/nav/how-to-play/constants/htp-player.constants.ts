import {
  MlbBatting,
  MlbLeagueDivision,
  MlbPlayerAttributes,
  MlbTeam,
  MlbPositionEnum,
  MlbThrowing,
  MlbUiPlayer,
  MlbTeamKey,
} from '../../../game/bio-ball/models/mlb.models';
import { PlayerAttrColor } from 'src/app/shared/models/common-models';
import { CountryBorn } from '../../../game/bio-ball/models/bio-ball.models';
import { CareerPathPlayer } from 'src/app/game/career-path/models/career-path.models';

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
            from: 2016,
            to: 2017,
            logoBorderColor: PlayerAttrColor.NONE,
            yearColor: PlayerAttrColor.NONE,
          },
        ],
      },
    ],
  },
];
