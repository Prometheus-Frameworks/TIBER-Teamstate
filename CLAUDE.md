# TIBER-Teamstate agent guidance

## MERGE_POLICY

This policy is path-based. It does not grant exceptions based on change size,
intent, apparent safety, or test results.

| Path | Merge authorization |
| --- | --- |
| `docs/contracts/**` | Operator approval required |
| `src/contracts/**` | Operator approval required |
| `exports/promoted/**` | Operator approval required |
| `schemas/**` | Operator approval required |
| `**/*.schema.json` | Operator approval required |
| `data/fixtures/team_week_raw_governed/**` | Operator approval required |

All paths not listed as eligible below also require operator approval.

### Agent self-merge eligibility

None. In v0, no TIBER-Teamstate path is eligible for agent self-merge.
