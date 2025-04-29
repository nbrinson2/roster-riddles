import { MlbPlayerAttributes, MlbTeam, MlbTeamFullName } from "./mlb-models";
import { NflPlayerAttributes, NflTeam, NflTeamFullName } from "./nfl-models";

export interface UiPlayer<T> {
  name: string;
  age: string;
  colorMap: Map<T, PlayerAttrColor>;
}

export type TeamUiPlayer<T> = UiPlayer<T> & {team: TeamType, pos: string};
export type AttributesType = MlbPlayerAttributes | NflPlayerAttributes;
export type TeamType = MlbTeam | NflTeam;
export type TeamFullName = MlbTeamFullName | NflTeamFullName;

export enum CommonAttributes {
  NAME = 'name',
  AGE = 'age',
  COLOR_MAP = 'colorMap',
}

export enum HiddenPlayerRosterAttributes {
  TEAM = 'team',
  LG_DIV = 'lgDiv',
  CONF_DIV = 'confDiv',
  COLOR_MAP = 'colorMap',
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

export enum PlayerAttrColor {
  BLUE = 'blue',
  ORANGE = 'orange',
  NONE = 'none'
}

