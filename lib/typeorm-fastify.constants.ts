import { Propagation } from './typeorm-fastify.enums';

export const TYPE_ORM_STORAGE = 'TYPE_ORM_STORAGE';

export const ENTITY_MANAGER = 'entity_manager';

export const TRANSACTIONAL_OPTIONS = 'transactional_options';

export const DEFAULT_OPTIONS = {
  propagation: Propagation.REQUIRED,
};
