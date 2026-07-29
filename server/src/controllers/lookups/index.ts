import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LookupListQuery, LookupTableName } from '../../interfaces/lookups';
import { LookupsService } from '../../services/lookups.service';
import { respondWithData } from '../master-data-response';

export const listLookup =
  (table: LookupTableName) =>
  (request: FastifyRequest, reply: FastifyReply) =>
    respondWithData(request, reply, () =>
      new LookupsService(request.server).list(
        table,
        request.query as LookupListQuery,
      ),
    );
