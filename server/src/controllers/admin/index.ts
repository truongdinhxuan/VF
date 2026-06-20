import { FastifyRequest, FastifyReply } from 'fastify';

export const adminIndex = (request: FastifyRequest, reply: FastifyReply) => {
  return reply.code(200).send({
    message: "đây là endpoint admin"
  })
}