import { buildTeamWeekRawV0GovernedReadinessFile } from './teamWeekRawV0GovernedReadiness.js';

const main = (): void => {
  const filePath = process.argv[2];
  if (filePath === undefined || filePath.trim().length === 0) {
    process.stderr.write('Usage: node dist/src/governed/runTeamWeekRawV0GovernedReadiness.js <governed-artifact.json>\n');
    process.exitCode = 2;
    return;
  }
  const report = buildTeamWeekRawV0GovernedReadinessFile(filePath);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.stderr.write(`${report.readinessStatus}: ${report.rowCount} rows (${report.provenanceStatus} / ${report.governance.governanceStatus} via ${report.governance.governanceSource})\n`);
  process.exitCode = report.readinessStatus === 'ready_minimal_boundary' ? 0 : 1;
};

main();
