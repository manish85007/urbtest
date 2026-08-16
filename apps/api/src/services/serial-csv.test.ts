import { describe, expect, it } from 'vitest';
import { parseSerialCsv } from './serial-service.js';
import { dateInPeriod, parseReportPeriod } from '@urb-tectrack/shared';

describe('parseSerialCsv', () => {
  it('reads kit template headers', () => {
    const csv = `"Serial","AssetTag","Item","Condition","Weight"
"WD-A1023X","TC-HD-9821","Seagate 1TB HDD","end-of-life","0.62"`;
    const rows = parseSerialCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].serialNo).toBe('WD-A1023X');
    expect(rows[0].assetTag).toBe('TC-HD-9821');
    expect(rows[0].make).toBe('Seagate 1TB HDD');
  });
});

describe('report period', () => {
  it('matches FY dates', () => {
    const period = parseReportPeriod({ period: 'fy', fy: 'FY 2025-26' });
    expect(dateInPeriod(new Date('2025-08-01'), period)).toBe(true);
    expect(dateInPeriod(new Date('2025-03-01'), period)).toBe(false);
  });
});
