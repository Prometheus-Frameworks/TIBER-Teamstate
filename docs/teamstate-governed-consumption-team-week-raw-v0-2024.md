# Teamstate Governed Consumption: 2024 `team_week_raw_v0`

This boundary is Teamstate downstream consumption only. TIBER-Data owns the `team_week_raw_v0` source governance decision; Teamstate accepts that source only when the artifact declares all three explicit markers:

- `metadata.provenanceStatus: "governed_real_data"`
- `metadata.governance.governanceStatus: "governed"`
- `metadata.governance.governanceSource: "explicit_marker"`

Missing metadata, malformed governance, non-governed provenance, non-`governed` status, or any non-explicit governance source fails closed. Paths, names, validation success, coverage success, or downstream usefulness are never used to infer governance.

## Preserved upstream references

The governed loader preserves these upstream references in Teamstate's report:

- `sourceArtifactPath`
- top-level `sourceArtifacts`
- `metadata.validationReportPath`
- `metadata.lineageManifestPath`
- `metadata.governance`
- `metadata.fieldReadiness`
- `metadata.deferredFields`

## Field posture

Teamstate emits the smallest safe governed readiness artifact: `team_week_raw_v0_governed_readiness`. It is a readiness boundary, not Forecast Run 2, model training, scoring, ranking, or fantasy product output.

- `pressureRateAllowed` must remain `null` in every row and must be declared deferred upstream. It is reported as `deferred_insufficient_data` with posture `unavailable_insufficient_data_deferred`.
- Pressure is never converted to zero, inferred from sacks, estimated, backfilled, or imputed.
- Red-zone nulls, such as `redZoneTdRate` when only some rows have zero red-zone trips, are classified as `partial_nulls`; they are not zero-filled and not marked deferred.
- Fantasy split fields (`fantasyPointsForQB/RB/WR/TE` and `fantasyPointsAllowedQB/RB/WR/TE`) may be present in the upstream governed source only as `null`; Teamstate strips them from its row shape and fails closed on any non-null fantasy split value.

## CLI

After building, run:

```bash
npm run readiness:governed -- <path-to-governed-team_week_raw_v0.json>
```

The CLI prints the readiness report as JSON and exits non-zero only when coverage is invalid or the source fails boundary validation.
