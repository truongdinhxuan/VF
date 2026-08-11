import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  CreateMilkrunStockAdjustmentBody,
  MilkrunStockBalanceListQuery,
  MilkrunStockTransactionListQuery,
} from '../../interfaces/milkrun-stock';
import { MilkrunStockService } from '../../services/milkrun-stock.service';
import { respondWithData } from '../master-data-response';

const service = (request: FastifyRequest) =>
  new MilkrunStockService(request.server);

export const listMilkrunStockBalances = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(
  request,
  reply,
  () => service(request).listBalances(
    request.query as MilkrunStockBalanceListQuery,
  ),
);

export const listMilkrunStockTransactions = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(
  request,
  reply,
  () => service(request).listTransactions(
    request.query as MilkrunStockTransactionListQuery,
  ),
);

export const createMilkrunStockAdjustment = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(
  request,
  reply,
  () => service(request).createAdjustment(
    request.user.id,
    request.body as CreateMilkrunStockAdjustmentBody,
  ),
  201,
);

