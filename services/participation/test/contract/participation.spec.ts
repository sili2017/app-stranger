import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DomainExceptionFilter } from '@stranger/ts-platform';
import {
  ParticipationController,
  CancellationController,
} from '../../src/participation.controller';
import { ParticipationService } from '../../src/participation.service';

/**
 * T066: contract test for POST /offers/{id}/expressions-of-interest and
 * POST /offers/{id}/selections against contracts/public/offer-service.md, exercised
 * through a fake ParticipationService (no live Postgres in this environment — see
 * services/offer/test/contract/publish-offer.spec.ts for the same pattern).
 */
describe('Participation endpoints (contract, T066)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const fakeService: Partial<ParticipationService> = {
      expressInterest: async (offerId, recipientUserId) =>
        ({
          id: 'eoi-uuid',
          offerId,
          recipientUserId,
          message: null,
          createdAt: new Date(),
        }) as any,
      select: async (offerId, _caller, expressionOfInterestId) =>
        ({
          id: 'selection-uuid',
          offerId,
          expressionOfInterestId,
          outcome: 'pending',
        }) as any,
      listExpressionsOfInterest: async (offerId) =>
        [
          {
            id: 'eoi-uuid',
            offerId,
            recipientUserId: 'recipient-1',
            message: 'hi',
            createdAt: new Date(),
            selected: false,
          },
        ] as any,
      listSelectionsVisibleTo: async (offerId) =>
        [
          { id: 'selection-uuid', offerId, recipientUserId: 'recipient-1', outcome: 'happened' },
        ] as any,
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ParticipationController, CancellationController],
      providers: [{ provide: ParticipationService, useValue: fakeService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST expressions-of-interest returns 201 with the created ExpressionOfInterest', async () => {
    const response = await request(app.getHttpServer())
      .post('/offers/offer-1/expressions-of-interest')
      .send({ message: 'sounds fun, on my way!' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ offerId: 'offer-1' });
  });

  it('POST selections returns 201 with the created Selection', async () => {
    const response = await request(app.getHttpServer())
      .post('/offers/offer-1/selections')
      .send({ expressionOfInterestId: 'eoi-uuid' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ offerId: 'offer-1', outcome: 'pending' });
  });

  it('GET expressions-of-interest returns 200 with the creator-visible list (quickstart.md Story 3 step 1)', async () => {
    const response = await request(app.getHttpServer()).get(
      '/offers/offer-1/expressions-of-interest',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ id: 'eoi-uuid', offerId: 'offer-1', selected: false }),
    ]);
  });

  it('GET selections/mine returns 200 with the caller-visible selections (Story 4 rating lookup)', async () => {
    const response = await request(app.getHttpServer()).get('/offers/offer-1/selections/mine');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ id: 'selection-uuid', offerId: 'offer-1', outcome: 'happened' }),
    ]);
  });
});
