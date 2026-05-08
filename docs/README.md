# Teamstate Docs

## Future TIBER-Data `roster_snapshot_v0` Consumption

Teamstate does **not** own roster truth. TIBER-Teamstate consumes roster truth from TIBER-Data and produces deterministic team-environment interpretation from that upstream artifact context.

### Ownership Boundary

- **TIBER-Data owns canonical roster truth**, including roster identity, team membership, transaction source references, and temporal validity.
- **Teamstate consumes roster snapshots** to produce team-level context and environment interpretation.
- **Fantasy consumes Teamstate interpretation**, not raw guessed roster state.

### Allowed Teamstate Derivations

When `roster_snapshot_v0` artifacts provide the necessary upstream truth, Teamstate may derive team-environment context such as:

- QB environment change
- offensive skill group stability
- defensive teardown/build-up
- draft capital context
- regime volatility
- roster continuity
- team confidence tags

### Guardrails

- Teamstate must not invent roster membership or player IDs.
- Teamstate must not become a shadow roster database.
- Teamstate outputs must preserve roster artifact references and timestamps where applicable.
- Teamstate should treat roster snapshots as read-only governed inputs from TIBER-Data.
- No ingestion pipeline, scoring, or runtime behavior changes are implied by this alignment note.

### Illustrative Jets Example

For the Jets, TIBER-Data knows the verified roster and transaction truth. Teamstate may consume that truth and interpret the team environment as:

- offensive environment change candidate
- Garrett Wilson rebound context
- Breece Hall insulation
- defensive teardown risk
- regime volatility remains

This example is illustrative only: Teamstate should make these interpretations only from source-backed TIBER-Data roster artifacts and should preserve the applicable artifact references and timestamps in downstream outputs when available.
