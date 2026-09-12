import 'reflect-metadata';
import {
  ReportRetentionScheduler,
  REPORT_RETENTION_MS,
} from '../../src/moderation/report-retention-scheduler';
import { FakePrismaService } from '../fake-prisma';

/**
 * Convergence T130 (FR-015, Clarifications Session 2026-09-12 round 2): a resolved
 * Report is anonymized 12 months after decidedAt — except under an active legal hold,
 * never before the deadline, and never a still-pending report (no decidedAt).
 */
describe('ReportRetentionScheduler (T130, FR-015)', () => {
  it('anonymizes a resolved report once past the 12-month retention window', async () => {
    const prisma = new FakePrismaService();
    await prisma.report.create({
      data: {
        reporterUserId: 'user-1',
        subjectType: 'user',
        subjectId: 'user-2',
        reason: 'harassment',
        status: 'enforced',
        decidedAt: new Date(Date.now() - REPORT_RETENTION_MS - 60_000),
      },
    });

    const scheduler = new ReportRetentionScheduler(prisma as any);
    await scheduler.tick();

    const report = [...prisma.reports.values()][0];
    expect(report.reporterUserId).toBe('[anonymized]');
    expect(report.reason).toBeNull();
  });

  it('does not touch a resolved report still within the 12-month window', async () => {
    const prisma = new FakePrismaService();
    await prisma.report.create({
      data: {
        reporterUserId: 'user-1',
        subjectType: 'user',
        subjectId: 'user-2',
        reason: 'harassment',
        decidedAt: new Date(Date.now() - REPORT_RETENTION_MS + 60_000),
      },
    });

    const scheduler = new ReportRetentionScheduler(prisma as any);
    await scheduler.tick();

    expect([...prisma.reports.values()][0].reporterUserId).toBe('user-1');
  });

  it('never anonymizes a report under an active legal hold', async () => {
    const prisma = new FakePrismaService();
    await prisma.report.create({
      data: {
        reporterUserId: 'user-1',
        subjectType: 'user',
        subjectId: 'user-2',
        decidedAt: new Date(Date.now() - REPORT_RETENTION_MS - 60_000),
        legalHold: true,
      },
    });

    const scheduler = new ReportRetentionScheduler(prisma as any);
    await scheduler.tick();

    expect([...prisma.reports.values()][0].reporterUserId).toBe('user-1');
  });

  it('never touches a still-pending report with no decidedAt', async () => {
    const prisma = new FakePrismaService();
    await prisma.report.create({
      data: { reporterUserId: 'user-1', subjectType: 'user', subjectId: 'user-2' },
    });

    const scheduler = new ReportRetentionScheduler(prisma as any);
    await scheduler.tick();

    expect([...prisma.reports.values()][0].reporterUserId).toBe('user-1');
  });
});
