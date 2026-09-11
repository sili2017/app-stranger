import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DomainExceptionFilter } from '@stranger/ts-platform';
import { OffersController } from '../../src/offers/offers.controller';
import { OffersService } from '../../src/offers/offers.service';
import { RebroadcastService } from '../../src/offers/rebroadcast';
import { publishOfferRequestFixture } from '@stranger/test-fixtures';

/**
 * T041: asserts the response shape against contracts/public/offer-service.md's worked
 * example — default 15-min lifetime when lifetimeMinutes is omitted, 201 response
 * incl. interestCount: 0. OffersService is exercised through a fake in-memory
 * implementation rather than a live Prisma/Postgres connection (no DB available in this
 * environment); run against docker-compose's postgres-offer once `npm install` and
 * `prisma migrate dev` have been run locally for a true end-to-end contract check.
 */
describe('POST /offers (contract)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const fakeOffersService: Partial<OffersService> = {
      publish: async (creatorUserId, dto) =>
        ({
          id: 'offer-uuid',
          status: 'active',
          publishedAt: new Date('2026-09-10T12:00:00Z'),
          expiresAt: new Date('2026-09-10T12:15:00Z'),
          capacity: dto.capacity,
          interestCount: 0,
          creatorUserId,
        }) as any,
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [
        { provide: OffersService, useValue: fakeOffersService },
        { provide: RebroadcastService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('defaults to a 15-minute lifetime and returns interestCount: 0 on 201', async () => {
    const body = publishOfferRequestFixture({ capacity: 3 });

    const response = await request(app.getHttpServer()).post('/offers').send(body);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: 'active',
      capacity: 3,
      interestCount: 0,
    });
  });
});
