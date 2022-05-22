import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { from, Observable, throwError } from 'rxjs';
import { Connection } from 'typeorm';
import { getConnectionToken } from '@nestjs/typeorm';
import { ModuleRef, Reflector } from '@nestjs/core';
import {
  TRANSACTIONAL_OPTIONS,
  TYPE_ORM_STORAGE,
} from './typeorm-fastify.constants';
import {
  catchError,
  finalize,
  mapTo,
  mergeMap,
  mergeMapTo,
} from 'rxjs/operators';
import { deleteEntityManager, setEntityManager } from './typeorm-fastify.utils';
import { getRequest } from './context.utils';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const options = this.reflector.get(
      TRANSACTIONAL_OPTIONS,
      context.getHandler(),
    );
    const connectionToken = getConnectionToken(options?.connection) as string;
    const connection = await this.moduleRef.get<Connection>(connectionToken, {
      strict: false,
    });
    const queryRunner = connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction(options?.isolation);

    const request = getRequest(context);
    const store = new Map();
    request.requestContext.set(TYPE_ORM_STORAGE, store);

    setEntityManager(store, options, queryRunner.manager);

    return next.handle().pipe(
      mergeMap((res) => {
        return from(queryRunner.commitTransaction()).pipe(mapTo(res));
      }),
      catchError((err) => {
        return from(queryRunner.rollbackTransaction()).pipe(
          mergeMapTo(throwError(err)),
        );
      }),
      finalize(() => {
        deleteEntityManager(store, options);
        return from(queryRunner.release());
      }),
    );
  }
}
