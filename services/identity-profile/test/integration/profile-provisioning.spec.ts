import 'reflect-metadata';
import { VerificationService } from '../../src/verification/verification.service';
import { ageRangeLabelFor } from '../../src/verification/verification.service';
import { ProfilesService } from '../../src/profiles/profiles.service';
import { FakePrismaService } from '../fake-prisma';

/**
 * Regression test for a real gap found during live end-to-end verification: nothing in
 * this codebase ever created a PublicProfile row (only UserAccount), which silently made
 * the public rating summary (FR-024) a no-op for every user, and no GET endpoint existed
 * to read a profile at all. Both are fixed by this change — signup now provisions a
 * PublicProfile alongside UserAccount, and GET /profiles/:userId exposes it.
 */
describe('Public profile provisioning at signup (FR-013, FR-024)', () => {
  function buildVerificationService(prisma: FakePrismaService) {
    const events = { userEligibilityChanged: async () => undefined };
    const audit = { record: async () => undefined };
    return new VerificationService(prisma as any, events as any, audit as any);
  }

  it('creates a PublicProfile alongside UserAccount on signup, with a derived age range and no exact DOB', async () => {
    const prisma = new FakePrismaService();
    const service = buildVerificationService(prisma);

    await service.completeSignupAgeAssurance(
      'user-1',
      { dateOfBirth: '1996-01-01', livenessResult: 'passed' },
      'corr-1',
    );

    const profile = await prisma.publicProfile.findUnique({ where: { userId: 'user-1' } });
    expect(profile).not.toBeNull();
    expect(profile.ageRangeLabel).toMatch(/^\d+-\d+$/);
    expect(profile).not.toHaveProperty('dateOfBirth');
    expect(profile.verificationStatus).toBe('photo_verified');
  });

  it('marks verificationStatus unverified when liveness is flagged rather than passed', async () => {
    const prisma = new FakePrismaService();
    const service = buildVerificationService(prisma);

    await service.completeSignupAgeAssurance(
      'user-2',
      { dateOfBirth: '1996-01-01', livenessResult: 'flagged_possible_minor' },
      'corr-2',
    );

    const profile = await prisma.publicProfile.findUnique({ where: { userId: 'user-2' } });
    expect(profile.verificationStatus).toBe('unverified');
  });

  it('is safe to call twice (re-signup does not duplicate or crash)', async () => {
    const prisma = new FakePrismaService();
    const service = buildVerificationService(prisma);
    const dto = { dateOfBirth: '1990-05-05', livenessResult: 'passed' as const };

    await service.completeSignupAgeAssurance('user-3', dto, 'corr-3a');
    await service.completeSignupAgeAssurance('user-3', dto, 'corr-3b');

    const profile = await prisma.publicProfile.findUnique({ where: { userId: 'user-3' } });
    expect(profile).not.toBeNull();
  });
});

describe('ageRangeLabelFor (data-model.md: derived, never the exact dateOfBirth)', () => {
  it('buckets into 5-year ranges', () => {
    const turns27 = new Date();
    turns27.setFullYear(turns27.getFullYear() - 27);
    expect(ageRangeLabelFor(turns27)).toBe('25-30');

    const turns31 = new Date();
    turns31.setFullYear(turns31.getFullYear() - 31);
    expect(ageRangeLabelFor(turns31)).toBe('30-35');
  });
});

describe('ProfilesService.getPublicProfile (FR-013)', () => {
  it('returns only Controlled-public fields for an existing profile', async () => {
    const prisma = new FakePrismaService();
    await prisma.publicProfile.upsert({
      where: { userId: 'user-4' },
      create: {
        userId: 'user-4',
        firstName: 'A',
        ageRangeLabel: '25-30',
        verificationStatus: 'photo_verified',
        publicRatingAverage: 4.5,
        publicRatingCount: 2,
      },
    });
    const service = new ProfilesService(prisma as any);

    const result = await service.getPublicProfile('user-4');
    expect(result).toEqual({
      userId: 'user-4',
      firstName: 'A',
      photoAssetId: null,
      ageRangeLabel: '25-30',
      interests: [],
      verificationStatus: 'photo_verified',
      languagePreference: 'en',
      publicRatingAverage: 4.5,
      publicRatingCount: 2,
    });
    expect(result).not.toHaveProperty('dateOfBirth');
  });

  it('throws NOT_FOUND for a user with no profile', async () => {
    const prisma = new FakePrismaService();
    const service = new ProfilesService(prisma as any);
    await expect(service.getPublicProfile('nobody')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
