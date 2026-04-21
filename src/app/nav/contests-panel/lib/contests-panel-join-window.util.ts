import type { ContestListRow } from './contests-panel.types';

export function canAttemptJoinContest(
  row: ContestListRow,
  nowMs: number,
): boolean {
  if (row.status !== 'open') {
    return false;
  }
  return (
    nowMs >= row.windowStart.getTime() && nowMs < row.windowEnd.getTime()
  );
}

export function joinDisabledReasonForContest(
  row: ContestListRow,
  nowMs: number,
): string | null {
  if (row.status === 'scheduled') {
    return 'This contest is not open for entry yet.';
  }
  if (row.status !== 'open') {
    return 'Join is not available for this contest.';
  }
  if (nowMs < row.windowStart.getTime()) {
    return 'The entry window has not started.';
  }
  if (nowMs >= row.windowEnd.getTime()) {
    return 'The entry window has ended.';
  }
  return null;
}
