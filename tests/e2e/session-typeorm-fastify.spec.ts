import { Test } from '@nestjs/testing';
import * as Sinon from 'sinon';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../src/user.entity';
import { TypeormFastifyController } from '../src/typeorm-fastify.controller';
import { TypeormFastifyModule } from '../../lib';
import { UserRepository } from '../src/user.repository';
import { Connection } from 'typeorm';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { HttpStatus } from '@nestjs/common';
import { fastifyRequestContextPlugin } from 'fastify-request-context';

describe('TypeOrm session', () => {
  let app: NestFastifyApplication;
  let sandbox: Sinon.SinonSandbox;
  let connectionSpy: Sinon.SinonSpiedInstance<Connection>;
  let userRepository: UserRepository;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'postgres',
          entities: [User],
          synchronize: true,
          logging: 'all',
        }),
        TypeOrmModule.forFeature([UserRepository]),
        TypeormFastifyModule.forRoot(),
      ],
      controllers: [TypeormFastifyController],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await app.register(fastifyRequestContextPlugin);

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    sandbox = Sinon.createSandbox();

    const connection = app.get(Connection);

    userRepository = app.get(UserRepository);

    connectionSpy = sandbox.spy(connection);
  });

  afterAll(async () => {
    await app.close();
    sandbox.restore();
  });

  afterEach(async () => {
    await userRepository.delete({});
    sandbox.reset();
  });

  describe('when request is ok', () => {
    it('should create an user', async () => {
      const res = await app.inject({
        method: 'POST',
        path: '/',
        payload: {
          name: 'Pavel',
        },
      });

      const body = res.json();

      expect(connectionSpy.createQueryRunner.calledOnce).toBeTruthy();
      const queryRunner =
        connectionSpy.createQueryRunner.getCall(0).returnValue;

      expect(queryRunner.isTransactionActive).toBeFalsy();
      expect(queryRunner.isReleased).toBeTruthy();

      expect(res).toMatchObject({
        statusCode: HttpStatus.CREATED,
      });

      expect(body).toMatchObject({
        name: 'Pavel',
      });
    });
  });

  describe('when error is thrown', () => {
    it('should rollback and return 500', async () => {
      const res = await app.inject({
        method: 'GET',
        path: '/',
      });

      const body = res.json();

      const queryRunner =
        connectionSpy.createQueryRunner.getCall(0).returnValue;

      expect(queryRunner.isTransactionActive).toBeFalsy();
      expect(queryRunner.isReleased).toBeTruthy();

      expect(res).toMatchObject({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      });

      expect(body).toMatchObject({
        statusCode: 500,
        message: 'Internal Server Error',
        error: 'Internal Server Error',
      });
    });
  });

  describe('query builder', () => {
    describe('when request is ok', () => {
      it('should create an user', async () => {
        const res = await app.inject({
          method: 'POST',
          path: '/builder',
          payload: { name: 'Pavel' },
        });

        const body = res.json();

        expect(connectionSpy.createQueryRunner.calledOnce).toBeTruthy();
        const queryRunner =
          connectionSpy.createQueryRunner.getCall(0).returnValue;

        expect(queryRunner.isTransactionActive).toBeFalsy();
        expect(queryRunner.isReleased).toBeTruthy();
        expect(res).toMatchObject({
          statusCode: HttpStatus.CREATED,
        });

        expect(body).toMatchObject({
          name: 'Pavel',
        });
      });
    });
  });
});
