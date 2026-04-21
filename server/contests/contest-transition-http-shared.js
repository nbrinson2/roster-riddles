/**
 * Shared HTTP mapping for `runContestStatusTransition` outcomes (operator + admin routes).
 */
import { logContestTransitionLine } from './contest-transition-log.js';

/**
 * @param {import('express').Response} res
 * @param {object} ctx
 * @param {object} ctx.outcome
 * @param {string} ctx.requestId
 * @param {number} ctx.startMs
 * @param {string} ctx.contestId
 * @param {'open'|'scheduled'|'scoring'|'paid'|'cancelled'} ctx.targetTo
 * @param {boolean} ctx.force
 * @param {string | null | undefined} ctx.adminUid
 * @param {string | undefined} ctx.reason
 * @param {'admin'|'system'} ctx.actorType
 */
export function sendContestTransitionHttpResult(res, ctx) {
  const {
    outcome,
    requestId,
    startMs,
    contestId,
    targetTo,
    force,
    adminUid,
    reason,
    actorType,
  } = ctx;

  if (outcome.type === 'missing') {
    logContestTransitionLine({
      requestId,
      outcome: 'contest_not_found',
      httpStatus: 404,
      latencyMs: Date.now() - startMs,
      contestId,
      actorType,
      adminUid: adminUid ?? null,
      targetStatus: targetTo,
    });
    return res.status(404).json({
      error: { code: 'contest_not_found', message: 'Contest not found.' },
    });
  }

  if (outcome.type === 'bad_doc' || outcome.type === 'bad_status') {
    logContestTransitionLine({
      requestId,
      outcome: 'contest_invalid_shape',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      contestId,
      actorType,
    });
    return res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Contest document is invalid.',
      },
    });
  }

  if (outcome.type === 'guard') {
    logContestTransitionLine({
      requestId,
      outcome: outcome.code,
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
      contestId,
      actorType,
      adminUid: adminUid ?? null,
      from: outcome.from,
      targetStatus: targetTo,
      force,
    });
    return res.status(400).json({
      error: {
        code: outcome.code,
        message: outcome.message,
      },
    });
  }

  if (outcome.type === 'idempotent') {
    logContestTransitionLine({
      requestId,
      outcome: 'idempotent',
      httpStatus: 200,
      latencyMs: Date.now() - startMs,
      contestId,
      actorType,
      adminUid: adminUid ?? null,
      status: outcome.status,
      targetStatus: targetTo,
    });
    return res.status(200).json({
      idempotentReplay: true,
      contestId,
      status: outcome.status,
    });
  }

  logContestTransitionLine({
    requestId,
    outcome: 'ok',
    httpStatus: 200,
    latencyMs: Date.now() - startMs,
    contestId,
    actorType,
    adminUid: adminUid ?? null,
    from: outcome.from,
    to: outcome.to,
    force: force || undefined,
    overrideReason: reason?.slice(0, 500) || undefined,
    dryRunArtifactsCleared: outcome.dryRunArtifactsCleared || undefined,
  });

  return res.status(200).json({
    contestId,
    from: outcome.from,
    to: outcome.to,
    actorType,
    adminUid: adminUid ?? null,
    dryRunArtifactsCleared: outcome.dryRunArtifactsCleared ?? false,
  });
}

/**
 * @param {import('express').Response} res
 * @param {object} ctx
 * @param {string} ctx.requestId
 * @param {number} ctx.startMs
 * @param {string} ctx.contestId
 * @param {unknown} ctx.err
 */
export function sendContestTransitionTransactionError(res, ctx) {
  const { requestId, startMs, contestId, err } = ctx;
  const msg = err instanceof Error ? err.message.slice(0, 500) : String(err);
  logContestTransitionLine({
    requestId,
    outcome: 'transaction_failed',
    httpStatus: 500,
    latencyMs: Date.now() - startMs,
    contestId,
    message: msg,
  });
  return res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Could not update contest status.',
    },
  });
}
