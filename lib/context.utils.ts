import { ContextType, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

export function getRequest(host: ExecutionContext): FastifyRequest | null {
  const type = host.getType<'graphql' | ContextType>();

  if (type === 'http') {
    const ctx = host.switchToHttp();
    return ctx.getRequest();
  } else if (type === 'graphql') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GqlExecutionContext } = require('@nestjs/graphql');
    const ctx = GqlExecutionContext.create(host).getContext();
    return ctx.req;
  }

  return null;
}
