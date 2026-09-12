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
    return this.toPublic(profile);
  }

  /** Only the fields a user may edit themselves — everything else (verificationStatus,
   * ageRangeLabel, ratings) is derived or set by a different, more specific flow. */
  async updateProfile(userId: string, dto: { firstName?: string; interests?: string[] }) {
    const existing = await this.prisma.publicProfile.findUnique({ where: { userId } });
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'errors.profileNotFound', HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.publicProfile.update({
      where: { userId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.interests !== undefined ? { interests: dto.interests } : {}),
      },
    });
    return this.toPublic(updated);
  }

  private toPublic(profile: {
    userId: string;
    firstName: string;
    photoAssetId: string | null;
    ageRangeLabel: string;
    interests: string[];
    verificationStatus: string;
    languagePreference: string;
    publicRatingAverage: number | null;
    publicRatingCount: number;
  }) {
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
