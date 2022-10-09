import { Inject } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { getConnectionToken } from '@nestjs/typeorm';
import { requestContext } from '@fastify/request-context';
import {
  Connectable,
  TransactionalOptions,
} from './typeorm-fastify.interfaces';
import { DEFAULT_OPTIONS, TYPE_ORM_STORAGE } from './typeorm-fastify.constants';
import { Propagation } from './typeorm-fastify.enums';
import {
  deleteEntityManager,
  getEntityManager,
  setEntityManager,
} from './typeorm-fastify.utils';

export function Transactional(options?: TransactionalOptions): MethodDecorator {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const { propagation, isolation } = opts;

  const injectConnection = Inject(getConnectionToken(opts.connection));

  return (
    target: any,
    propertyKey: string | symbol,
    propertyDescriptor: TypedPropertyDescriptor<any>,
  ) => {
    injectConnection(target, 'connection');

    const originalMethod = propertyDescriptor.value;

    propertyDescriptor.value = async function (...args: any[]) {
      const { connection } = this as Connectable;

      const store = requestContext.get(TYPE_ORM_STORAGE);

      if (!store) {
        throw new Error('Store is not configured');
      }

      const runOriginal = () => originalMethod.apply(this, args);

      const runWithNewTransaction = () => {
        const transactionCallback = async (manager: EntityManager) => {
          setEntityManager(store, opts.connection, manager);

          try {
            return await runOriginal();
          } finally {
            deleteEntityManager(store, opts.connection);
          }
        };

        if (isolation) {
          return connection.transaction(isolation, transactionCallback);
        } else {
          return connection.transaction(transactionCallback);
        }
      };

      const entityManager = getEntityManager(store, opts.connection);

      switch (propagation) {
        case Propagation.MANDATORY:
          if (!entityManager) {
            throw new Error(
              "No existing transaction found for transaction marked with propagation 'MANDATORY'",
            );
          }
          return runOriginal();
        case Propagation.NESTED:
          return runWithNewTransaction();
        case Propagation.NEVER:
          if (entityManager) {
            throw new Error(
              "Found an existing transaction, transaction marked with propagation 'NEVER'",
            );
          }
          return runOriginal();
        case Propagation.NOT_SUPPORTED:
          if (entityManager) {
            deleteEntityManager(store, opts.connection);
            const result = await runOriginal();
            setEntityManager(store, opts.connection, entityManager);

            return result;
          }
          return runOriginal();
        case Propagation.REQUIRED: {
          if (entityManager) {
            return runOriginal();
          }

          return runWithNewTransaction();
        }
        case Propagation.REQUIRES_NEW:
          return runWithNewTransaction();
        case Propagation.SUPPORTS:
          return runOriginal();
      }
    };

    Reflect.getMetadataKeys(originalMethod).forEach((previousMetadataKey) => {
      const previousMetadata = Reflect.getMetadata(
        previousMetadataKey,
        originalMethod,
      );
      Reflect.defineMetadata(
        previousMetadataKey,
        previousMetadata,
        propertyDescriptor.value,
      );
    });

    Object.defineProperty(propertyDescriptor.value, 'name', {
      value: originalMethod.name,
      writable: false,
    });
  };
}
