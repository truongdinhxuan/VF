import type { FastifyReply, FastifyRequest } from 'fastify';
import { StockServiceError } from '../services/stock.helpers';

export const respondWithStockData = async (
  request: FastifyRequest,
  reply: FastifyReply,
  handler: () => Promise<unknown>,
  successCode = 200,
) => {
  try {
    return reply.code(successCode).send({ data: await handler() });
  } catch (error) {
    if (error instanceof StockServiceError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};
