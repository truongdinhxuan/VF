import type { FastifyReply, FastifyRequest } from 'fastify';
import { UsersServiceError } from '../../services/users.service';

export const respondWithUserData = async (
  request: FastifyRequest,
  reply: FastifyReply,
  handler: () => Promise<unknown>,
  successCode = 200,
) => {
  try {
    return reply.code(successCode).send(await handler());
  } catch (error) {
    if (error instanceof UsersServiceError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Lỗi máy chủ nội bộ' });
  }
};
