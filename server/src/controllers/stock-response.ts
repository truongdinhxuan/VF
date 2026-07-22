import type { FastifyReply, FastifyRequest } from 'fastify';
import { StockServiceError } from '../services/stock.helpers';
import {
  isPaginatedResult,
  PaginationValidationError,
  toPaginatedResponse,
} from '../utils/pagination';

export const respondWithStockData = async (
  request: FastifyRequest,
  reply: FastifyReply,
  handler: () => Promise<unknown>,
  successCode = 200,
) => {
  try {
    const result = await handler();
    return reply.code(successCode).send(
      isPaginatedResult(result) ? toPaginatedResponse(result) : { data: result },
    );
  } catch (error) {
    if (error instanceof PaginationValidationError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof StockServiceError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};
