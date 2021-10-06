import { DynamicModule, Global, Module, OnModuleInit } from '@nestjs/common';
import { Connection, EntityTarget, QueryRunner, Repository } from 'typeorm';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { requestContext } from 'fastify-request-context';

import { getEntityManager, getQueryRunner } from './typeorm-fastify.utils';
import { TYPE_ORM_STORAGE } from './typeorm-fastify.constants';

@Global()
@Module({})
export class TypeormFastifyModule implements OnModuleInit {
  static forRoot(): DynamicModule {
    return {
      module: TypeormFastifyModule,
      imports: [DiscoveryModule],
      providers: [DiscoveryService],
    };
  }

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): any {
    const wrappers = this.discovery.getProviders();

    wrappers.forEach((wrapper) => {
      const instance = wrapper.instance;

      if (instance instanceof Repository) {
        Object.assign(instance, { _manager: instance.manager });
        Object.defineProperty(instance, 'manager', {
          get() {
            const store = requestContext.get(TYPE_ORM_STORAGE);

            if (store) {
              const entityManager = getEntityManager(
                store,
                this._manager.connection,
              );

              if (entityManager) {
                return entityManager;
              }
            }

            return this._manager;
          },
        });
      } else if (instance instanceof Connection) {
        Object.assign(instance, {
          _createQueryBuilder: instance.createQueryBuilder,
        });

        Object.defineProperty(instance, 'createQueryBuilder', {
          configurable: true,
          value<Entity>(
            entityOrRunner?: EntityTarget<Entity> | QueryRunner,
            alias?: string,
            queryRunner?: QueryRunner,
          ) {
            const store = requestContext.get(TYPE_ORM_STORAGE);
            let existingQueryRunner: QueryRunner;

            if (store) {
              existingQueryRunner = getQueryRunner(store, instance);
            }

            if (
              queryRunner ||
              (!alias && entityOrRunner) ||
              !existingQueryRunner
            ) {
              return this._createQueryBuilder(
                entityOrRunner,
                alias,
                queryRunner,
              );
            }

            if (!alias) {
              return this._createQueryBuilder(existingQueryRunner);
            } else {
              return this._createQueryBuilder(
                entityOrRunner,
                alias,
                existingQueryRunner,
              );
            }
          },
        });
      }
    });
  }
}
