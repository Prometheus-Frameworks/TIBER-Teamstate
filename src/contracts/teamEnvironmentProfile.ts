export type TeamEnvironmentTier = 'elite' | 'strong' | 'average' | 'weak' | 'unknown';
export type PassEnvironmentTier = 'pass_heavy' | 'balanced' | 'run_heavy' | 'unknown';
export type PaceTier = 'fast' | 'neutral' | 'slow' | 'unknown';
export type VolatilityTier = 'stable' | 'volatile' | 'unknown';

export interface TeamEnvironmentSignal {
  name: string;
  value: number | string | null;
  source: string;
  notes?: string;
}

export interface TeamEnvironmentProfileV0 {
  contractVersion: 'team_environment_profile_v0';
  teamId: string;
  teamAbbr: string;
  season: number;
  generatedAt: string;
  sourceSnapshotAt: string | null;
  marketTier: TeamEnvironmentTier;
  offenseTier: TeamEnvironmentTier;
  passEnvironmentTier: PassEnvironmentTier;
  paceTier: PaceTier;
  volatilityTier: VolatilityTier;
  signals: TeamEnvironmentSignal[];
  warnings: string[];
}

export interface TeamEnvironmentProfileArtifactV0 {
  artifact: 'team_environment_profiles_v0';
  generatedAt: string;
  sourceArtifacts: string[];
  metadata: TeamstateArtifactMetadataV0;
  profiles: TeamEnvironmentProfileV0[];
}

export type TeamstateProvenanceStatus =
  | 'fixture_scaffold'
  | 'sample'
  | 'partial_real_data'
  | 'governed_real_data'
  | 'unknown_provenance';

export interface TeamstateArtifactInputSource {
  path: string;
  type: 'sample' | 'fixture' | 'generated' | 'governed_artifact' | 'unknown';
  description?: string;
}

export interface TeamstateArtifactCoverageV0 {
  teamCount: number;
  expectedTeamCount: number;
  isFullLeague: boolean;
  presentTeams: string[];
  missingTeams: string[];
  seasons: number[];
  weeks: number[];
  latestWeek: number | null;
  gamesPerTeamMin: number | null;
  gamesPerTeamMax: number | null;
}

export interface TeamstateArtifactMetadataV0 {
  provenanceStatus: TeamstateProvenanceStatus;
  provenanceNotes: string[];
  generatedAt: string;
  inputSources: TeamstateArtifactInputSource[];
  coverage: TeamstateArtifactCoverageV0;
}
