// import { FastifyReply, FastifyRequest } from 'fastify';

// interface UpdateUserAvatar {
//     avatar_url: string
// }

// export const userUpdateAvatar = async (request: FastifyRequest, reply: FastifyReply) => {
//     try {
//         const { id } = request.params as { id: string }
//         const { avatar_url } = request.body as UpdateUserAvatar

//         if (!avatar_url) {
//             return reply.code(400).send({
//                 error: "Vui lòng "
//             })
//         }
//     } catch (error) {

//     }

// }