import { MlbBatting, MlbLeagueDivision, MlbPlayerAttributes, MlbTeam, MlbPositionEnum, MlbThrowing } from "../../game/bio-ball/models/mlb.models";
import { PlayerAttrColor } from '../../game/bio-ball/models/bio-ball.models';
import { CountryBorn } from "../../game/bio-ball/models/bio-ball.models";

export const PLAYERS = [
  { name: 'Johnny Player', team: MlbTeam.CHW, lgDiv: MlbLeagueDivision.AL_EAST, b: MlbBatting.R, t: MlbThrowing.L, born: CountryBorn.VEN, age: '33', pos: MlbPositionEnum.C, colorMap: new Map<MlbPlayerAttributes, PlayerAttrColor>() },
  { name: 'Johnny Player', team: MlbTeam.CHW, lgDiv: MlbLeagueDivision.AL_EAST, b: MlbBatting.R, t: MlbThrowing.L, born: CountryBorn.VEN, age: '33', pos: MlbPositionEnum.C, colorMap: new Map<MlbPlayerAttributes, PlayerAttrColor>() },
  { name: 'Johnny Player', team: MlbTeam.CHW, lgDiv: MlbLeagueDivision.AL_EAST, b: MlbBatting.R, t: MlbThrowing.L, born: CountryBorn.VEN, age: '33', pos: MlbPositionEnum.C, colorMap: new Map<MlbPlayerAttributes, PlayerAttrColor>() },
  { name: 'Johnny Player', team: MlbTeam.CHW, lgDiv: MlbLeagueDivision.AL_EAST, b: MlbBatting.R, t: MlbThrowing.L, born: CountryBorn.VEN, age: '33', pos: MlbPositionEnum.C, colorMap: new Map<MlbPlayerAttributes, PlayerAttrColor>() },
];