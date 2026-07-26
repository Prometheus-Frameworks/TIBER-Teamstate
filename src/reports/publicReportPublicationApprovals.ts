/**
 * Operator-controlled publication approvals for public report versions.
 *
 * Phase 3 deliberately ships with no recorded approvals. The production publisher reads only
 * this module-owned registry; a caller cannot attach an approval to a publication request and
 * thereby attest to its own authority. A later, separately authorized approval-capture change may
 * populate this registry (or replace its storage mechanism) for an exact version and exact frozen
 * JSON/HTML digests.
 */

import type { PublicationApprovalRecord } from './publicOffensiveEnvironment2024Validator.js';

const RECORDED_PUBLIC_REPORT_APPROVALS: readonly PublicationApprovalRecord[] = Object.freeze([]);

/** Return the recorded operator approval bound to this exact version and content, if one exists. */
export const lookupRecordedPublicReportPublicationApproval = (
  reportVersionId: string,
  jsonSha256: string,
  htmlSha256: string
): PublicationApprovalRecord | null => {
  const approval = RECORDED_PUBLIC_REPORT_APPROVALS.find(
    (approval) =>
      approval.report_version_id === reportVersionId &&
      approval.json_sha256 === jsonSha256 &&
      approval.html_sha256 === htmlSha256
  );
  return approval === undefined ? null : Object.freeze({ ...approval });
};
