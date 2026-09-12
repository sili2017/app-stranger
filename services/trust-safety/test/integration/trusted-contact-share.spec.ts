import 'reflect-metadata';
import { TrustedContactsController } from '../../src/trusted-contacts/trusted-contacts.controller';
import { encryptContactHandle } from '../../src/trusted-contacts/encryption';
import { FakePrismaService } from '../fake-prisma';

/**
 * Convergence T132 (FR-015, Clarifications Session 2026-09-12 round 2): a manual
 * one-tap share returns the decrypted contact handle and a message built from the
 * offer's exact place — reusing Offer's own creator-or-accepted-recipient
 * authorization rather than a new access path.
 */
describe('Trusted-contact share (T132, FR-015)', () => {
  function req(userId: string) {
    return { verifiedPrincipal: { userId } } as any;
  }

  it('shares the exact place with the stored trusted contact', async () => {
    const prisma = new FakePrismaService();
    (prisma as any).trustedContactSetting = {
      findUnique: async () => ({ contactHandleEncrypted: encryptContactHandle('+15550001111') }),
    };
    const internal = {
      getExactPlace: async () => ({
        label: 'Central Perk',
        lat: 18.94,
        lng: 72.835,
        rendezvousInstruction: null,
        activityText: 'Board games',
        expiresAt: '2026-09-12T18:00:00.000Z',
      }),
    };
    const controller = new TrustedContactsController(prisma as any, internal as any);

    const result = await controller.share({ offerId: 'offer-1' }, req('user-1'));

    expect(result.contactHandle).toBe('+15550001111');
    expect(result.message).toContain('Board games');
    expect(result.message).toContain('Central Perk');
  });

  it('rejects when the caller has no stored trusted contact', async () => {
    const prisma = new FakePrismaService();
    (prisma as any).trustedContactSetting = { findUnique: async () => null };
    const internal = { getExactPlace: async () => null };
    const controller = new TrustedContactsController(prisma as any, internal as any);

    let caught: unknown;
    try {
      await controller.share({ offerId: 'offer-1' }, req('user-1'));
    } catch (err) {
      caught = err;
    }
    expect((caught as { code?: string })?.code).toBe('NO_TRUSTED_CONTACT');
  });

  it('rejects when the caller is not authorized for this offer (Offer returns null)', async () => {
    const prisma = new FakePrismaService();
    (prisma as any).trustedContactSetting = {
      findUnique: async () => ({ contactHandleEncrypted: encryptContactHandle('+15550001111') }),
    };
    const internal = { getExactPlace: async () => null };
    const controller = new TrustedContactsController(prisma as any, internal as any);

    let caught: unknown;
    try {
      await controller.share({ offerId: 'offer-1' }, req('user-1'));
    } catch (err) {
      caught = err;
    }
    expect((caught as { code?: string })?.code).toBe('OFFER_NOT_FOUND');
  });
});
