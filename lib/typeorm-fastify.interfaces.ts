import { Connection, ConnectionOptions } from 'typeorm';

import { IsolationLevel, Propagation } from './typeorm-fastify.enums';

export interface TransactionalOptions {
  connection?: Connection | ConnectionOptions | string;
  /**
   * The transaction isolation level.
   */
  isolation?: IsolationLevel;

  /**
   * The transaction propagation type.
   */
  propagation?: Propagation;
}

export interface Connectable {
  connection: Connection;
}
