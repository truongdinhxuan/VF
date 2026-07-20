import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  ActiveListQuery,
  CreateSupplyCategoryBody,
  UpdateSupplyCategoryBody,
} from '../../interfaces/master-data';
import { SupplyCategoriesService } from '../../services/supply-categories.service';
import { respondWithData } from '../master-data-response';

export const listSupplyCategories = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new SupplyCategoriesService(request.server).list(request.query as ActiveListQuery));

export const getSupplyCategory = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new SupplyCategoriesService(request.server).get(
      (request.params as { id: string }).id,
    ));

export const createSupplyCategory = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(
    request,
    reply,
    () => new SupplyCategoriesService(request.server).create(
      request.body as CreateSupplyCategoryBody,
    ),
    201,
  );

export const updateSupplyCategory = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new SupplyCategoriesService(request.server).update(
      (request.params as { id: string }).id,
      request.body as UpdateSupplyCategoryBody,
    ));

export const deleteSupplyCategory = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new SupplyCategoriesService(request.server).remove(
      (request.params as { id: string }).id,
    ));
