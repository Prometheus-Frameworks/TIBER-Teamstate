export interface PipelineCliArgs {
  inputPath: string;
  outputDir: string;
  season: number | null;
  week: number | null;
}

interface ParseDefaults {
  defaultInputPath: string;
  defaultOutputDir: string;
}

const parseOptionalPositiveInt = (token: string, flag: '--season' | '--week'): number => {
  const value = Number(token);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid value for ${flag}: ${token}`);
  }

  return value;
};

export const parsePipelineArgs = (argv: string[], defaults: ParseDefaults): PipelineCliArgs => {
  let inputPath: string | undefined;
  let outputDir: string | undefined;
  let season: number | null = null;
  let week: number | null = null;

  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--input' || token === '--output' || token === '--season' || token === '--week') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${token}`);
      }

      if (token === '--input') {
        inputPath = value;
      } else if (token === '--output') {
        outputDir = value;
      } else if (token === '--season') {
        season = parseOptionalPositiveInt(value, '--season');
      } else {
        week = parseOptionalPositiveInt(value, '--week');
      }

      index += 1;
      continue;
    }

    if (token.startsWith('--')) {
      throw new Error(`Unknown flag: ${token}`);
    }

    positional.push(token);
  }

  if (!inputPath && positional[0]) {
    inputPath = positional[0];
  }

  if (!outputDir && positional[1]) {
    outputDir = positional[1];
  }

  return {
    inputPath: inputPath ?? defaults.defaultInputPath,
    outputDir: outputDir ?? defaults.defaultOutputDir,
    season,
    week
  };
};
