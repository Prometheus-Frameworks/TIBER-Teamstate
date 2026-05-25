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
  profiles: TeamEnvironmentProfileV0[];
}
