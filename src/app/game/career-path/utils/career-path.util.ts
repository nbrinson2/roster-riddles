import { PlayerAttrColor } from "src/app/shared/models/common-models";
import { CareerPathPlayer, TimelineGroup, TeamStint } from "../models/career-path.models";

/**
 * For each group & each stint in the guessed player,
 * assign yearColor and logoBorderColor based on overlap
 * with the target player’s career.
 */
export function applyFeedbackColors(
  guess: CareerPathPlayer,
  target: CareerPathPlayer
) {
  // determine the target’s span once
  const allTargetStints = target.groups.flatMap(g => g.stints);
  const targetStart = Math.min(...allTargetStints.map(s => s.from));
  const targetEnd   = Math.max(...allTargetStints.map(s => s.to));

  for (const group of guess.groups) {
    // pick the color purely by numeric range now
    const yearColor = getYearColor(
      group.from, group.to,
      targetStart, targetEnd
    );

    group.stints.forEach(s => {
      s.yearColor = yearColor;
      // border logic stays the same…
      s.logoBorderColor = getLogoBorderColor(s, allTargetStints);
    });
  }
}

/** Build a Set<number> of every year covered by one-or-more groups */
export function buildYearSet(groups: TimelineGroup[]): Set<number> {
  const years = new Set<number>();
  for (const { from, to } of groups) {
    for (let y = from; y <= to; y++) {
      years.add(y);
    }
  }
  return years;
}

/**  
 * Blue if the group is fully inside the target’s career span,  
 * Orange if it overlaps at all,  
 * None otherwise  
 */
export function getYearColor(
  groupFrom: number,
  groupTo:   number,
  targetFrom:number,
  targetTo:  number
): PlayerAttrColor {
  // 1) fully contained → BLUE
  if (groupFrom >= targetFrom && groupTo <= targetTo) {
    return PlayerAttrColor.BLUE;
  }

  // Check if there's any overlap in years
  const targetRangeArray = Array.from({ length: targetTo - targetFrom + 1 }, (_, i) => targetFrom + i);
  const groupRangeArray = Array.from({ length: groupTo - groupFrom + 1 }, (_, i) => groupFrom + i);

  const overlap = targetRangeArray.some(year => groupRangeArray.includes(year));
  if (overlap) {
    return PlayerAttrColor.ORANGE;
  }

  // 3) no overlap → NONE
  return PlayerAttrColor.NONE;
}

/**
 * For a single stint, compare against every target stint *on the same team*:
 * - NONE if no overlap
 * - ORANGE if there is any overlap or if the team is new to the target
 * - BLUE if it fully covers all target stints on that team
 */
export function getLogoBorderColor(
  guessStint: TeamStint,
  targetStints: TeamStint[]
): PlayerAttrColor {
  // 1) gather all of the target’s years on this team
  const targetTeamYears = new Set<number>();
  for (const ts of targetStints) {
    if (ts.teamKey === guessStint.teamKey) {
      for (let y = ts.from; y <= ts.to; y++) {
        targetTeamYears.add(y);
      }
    }
  }

  // if the target never wore this team at all → no border
  if (targetTeamYears.size === 0) {
    return PlayerAttrColor.NONE;
  }

  // 2) build the full year range of the guessStint
  const guessYears: number[] = [];
  for (let y = guessStint.from; y <= guessStint.to; y++) {
    guessYears.push(y);
  }

  // 3) if *every* guess-year was covered by the target on that team → BLUE
  const fullCoverage = guessYears.every(y => targetTeamYears.has(y));
  if (fullCoverage) {
    return PlayerAttrColor.BLUE;
  }

  // If target played for this team at any point (but no year overlap) → ORANGE
  if (targetStints.some(ts => ts.teamKey === guessStint.teamKey)) {
    return PlayerAttrColor.ORANGE;
  }

  // 5) otherwise → NONE
  return PlayerAttrColor.NONE;
}



