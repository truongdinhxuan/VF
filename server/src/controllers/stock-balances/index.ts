import type { FastifyReply, FastifyRequest } from 'fastify';
import type { StockBalanceListQuery } from '../../interfaces/stock';
import { StockBalancesService } from '../../services/stock-balances.service';
import { respondWithStockData } from '../stock-response';

export const listStockBalances = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithStockData(request, reply, () =>
    new StockBalancesService(request.server).list(
      request.query as StockBalanceListQuery,
    ));

export const getStockBalance = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithStockData(request, reply, () =>
    new StockBalancesService(request.server).get(
      (request.params as { id: string }).id,
    ));
