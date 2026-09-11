import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

/**
 * FR-013/FR-024: the approved public profile view. Only Controlled-public fields
 * (data-model.md Sensitive-Data Classification) ever leave this service — no
 * dateOfBirth, no individual rating feedback text/photos, no report content.
 */
@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(userId: string) {
    const profile = await this.prisma.publicProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new DomainError('NOT_FOUND', 'errors.profileNotFound', HttpStatus.NOT_FOUND);
    }
    return {
      userId: profile.userId,
      firstName: profile.firstName,
      photoAssetId: profile.photoAssetId,
      ageRangeLabel: profile.ageRangeLabel,
      interests: profile.interests,
      verificationStatus: profile.verificationStatus,
      languagePreference: profile.languagePreference,
      publicRatingAverage: profile.publicRatingAverage,
      publicRatingCount: profile.publicRatingCount,
    };
  }
}
