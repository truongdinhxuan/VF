import type { FastifyReply, FastifyRequest } from 'fastify';
import type { StockTransactionListQuery } from '../../interfaces/stock';
import { StockTransactionsService } from '../../services/stock-transactions.service';
import { respondWithStockData } from '../stock-response';

export const listStockTransactions = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithStockData(request, reply, () =>
  new StockTransactionsService(request.server).list(
    request.query as StockTransactionListQuery,
  ));

export const getStockTransaction = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithStockData(request, reply, () =>
  new StockTransactionsService(request.server).get(
    (request.params as { id: string }).id,
  ));
