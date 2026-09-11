import { Injectable, HttpStatus } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { IdentityEventsProducer } from '../events/identity-events.producer';

/** A user MAY have any number of registered city interests (FR-023). */
@Injectable()
export class CityInterestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: IdentityEventsProducer,
  ) {}

  async list(userId: string) {
    return this.prisma.cityInterest.findMany({ where: { userId } });
  }

  async add(userId: string, cityId: string, correlationId: string) {
    const existing = await this.prisma.cityInterest.findUnique({
      where: { userId_cityId: { userId, cityId } },
    });
    if (existing) {
      return existing;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cityInterest.create({ data: { userId, cityId } });
      await this.events.cityInterestAdded(tx as any, userId, cityId, correlationId);
      return row;
    });
    return created;
  }

  async remove(userId: string, cityId: string, correlationId: string) {
    const existing = await this.prisma.cityInterest.findUnique({
      where: { userId_cityId: { userId, cityId } },
    });
    if (!existing) {
      throw new DomainError(
        'CITY_INTEREST_NOT_FOUND',
        'errors.cityInterestNotFound',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cityInterest.delete({ where: { id: existing.id } });
      await this.events.cityInterestRemoved(tx as any, userId, cityId, correlationId);
    });
  }
}
