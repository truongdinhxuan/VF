import type { FastifyPluginAsync } from 'fastify';
import {
  listNotifications,
  markNotificationRead,
  streamNotifications,
} from '../../controllers/notifications';
import { verifyToken } from '../../middleware/auth';
import {
  notificationListSchema,
  notificationReadSchema,
  notificationStreamSchema,
} from '../../schemas/notifications';

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [verifyToken],
    schema: notificationListSchema,
  }, listNotifications);

  fastify.patch('/:id/read', {
    preHandler: [verifyToken],
    schema: notificationReadSchema,
  }, markNotificationRead);

  fastify.get('/stream', {
    preHandler: [verifyToken],
    schema: notificationStreamSchema,
  }, streamNotifications);
};

export default notificationRoutes;
