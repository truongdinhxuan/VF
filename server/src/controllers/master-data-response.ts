import type { FastifyReply, FastifyRequest } from 'fastify';
import { MasterDataServiceError } from '../services/master-data.helpers';

export const respondWithData = async (
  request: FastifyRequest,
  reply: FastifyReply,
  handler: () => Promise<unknown>,
) => {
  try {
    return reply.code(200).send({ data: await handler() });
  } catch (error) {
    if (error instanceof MasterDataServiceError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};
