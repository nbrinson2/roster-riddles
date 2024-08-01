import { MlbPlayerAttributes, NflPlayerAttributes } from "./app/shared/enumeration/attributes";
import { PlayerAttributeColor } from "./app/shared/models/mlb-models";

export const MLB_PLAYERS = [
  { name: 'Mike Trout', team: 'LAA', lgDiv: 'AL West', b: 'R', t: 'R', born: 'USA', age: '29', pos: 'CF', colorMap: new Map<MlbPlayerAttributes, PlayerAttributeColor>() },
  { name: 'Mookie Betts', team: 'LAD', lgDiv: 'NL West', b: 'R', t: 'R', born: 'USA', age: '28', pos: 'RF', colorMap: new Map<MlbPlayerAttributes, PlayerAttributeColor>() },
  { name: 'Jacob deGrom', team: 'NYM', lgDiv: 'NL East', b: 'L', t: 'R', born: 'USA', age: '33', pos: 'SP', colorMap: new Map<MlbPlayerAttributes, PlayerAttributeColor>() },
  { name: 'Fernando Tatis Jr.', team: 'SD', lgDiv: 'NL West', b: 'R', t: 'R', born: 'DR', age: '22', pos: 'SS', colorMap: new Map<MlbPlayerAttributes, PlayerAttributeColor>() },
];

export const NFL_PLAYERS = [
  { name: 'Tom Brady', team: 'TB', lgDiv: 'NFC South', '#': '12', college: 'Michigan', draftYear: '2000', age: '44', position: 'QB', colorMap: new Map<NflPlayerAttributes, PlayerAttributeColor>() },
  { name: 'Aaron Donald', team: 'LA', lgDiv: 'NFC West', '#': '99', college: 'Pittsburgh', draftYear: '2014', age: '30', position: 'DT', colorMap: new Map<NflPlayerAttributes, PlayerAttributeColor>() },
  { name: 'Davante Adams', team: 'LV', lgDiv: 'AFC West', '#': '17', college: 'Fresno State', draftYear: '2014', age: '28', position: 'WR', colorMap: new Map<NflPlayerAttributes, PlayerAttributeColor>() },
  { name: 'Derrick Henry', team: 'TEN', lgDiv: 'AFC South', '#': '22', college: 'Alabama', draftYear: '2016', age: '27', position: 'RB', colorMap: new Map<NflPlayerAttributes, PlayerAttributeColor>() },
  { name: 'Patrick Mahomes', team: 'KC', lgDiv: 'AFC West', '#': '15', college: 'Texas Tech', draftYear: '2017', age: '26', position: 'QB', colorMap: new Map<NflPlayerAttributes, PlayerAttributeColor>() },
  { name: 'Jalen Ramsey', team: 'MIA', lgDiv: 'AFC East', '#': '5', college: 'Florida State', draftYear: '2016', age: '28', position: 'CB', colorMap: new Map<NflPlayerAttributes, PlayerAttributeColor>() },
];
