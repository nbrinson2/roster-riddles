import { NflPlayerAttributes } from "../enumeration/attributes";
import { PlayerAttributeColor } from "./mlb-models";

export interface NflPlayer {
    name: string;
    team: string;
    lgDiv: string;
    '#': string;
    college: string;
    draftYear: string;
    age: string;
    position: string;
    colorMap: Map<NflPlayerAttributes, PlayerAttributeColor>;
}