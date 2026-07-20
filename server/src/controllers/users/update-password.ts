import { FastifyReply, FastifyRequest } from 'fastify';

interface UpdatePasswordBody {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

const PASSWORD_RULE_MESSAGE =
  'Mật khẩu mới phải có ít nhất một chữ cái viết hoa, kí tự đặc biệt, số và độ dài lớn hơn 8';

const isValidNewPassword = (password: string): boolean => {
  const hasUppercase = /[A-Z]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasMinLength = password.length > 8;

  return hasUppercase && hasSpecialChar && hasNumber && hasMinLength;
};

export const userUpdatePassword = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { id } = request.params as { id: string };

    if (request.user?.id !== id) {
      return reply.code(403).send({ error: 'Bạn chỉ có thể đổi mật khẩu của chính mình' });
    }

    const { currentPassword, newPassword, confirmNewPassword } =
      request.body as UpdatePasswordBody;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return reply.code(400).send({ error: 'Vui lòng điền đầy đủ các trường bắt buộc' });
    }

    if (newPassword !== confirmNewPassword) {
      return reply.code(400).send({ error: 'Mật khẩu mới và xác nhận mật khẩu không khớp' });
    }

    if (!isValidNewPassword(newPassword)) {
      return reply.code(400).send({ error: PASSWORD_RULE_MESSAGE });
    }

    const { data: authData, error: getUserError } =
      await request.server.supabaseAdmin.auth.admin.getUserById(id);

    if (getUserError) {
      if (getUserError.code === 'user_not_found') {
        return reply.code(404).send({ error: 'Không tìm thấy người dùng' });
      }
      request.log.error(getUserError);
      return reply.code(400).send({ error: getUserError.message });
    }

    const email = authData.user.email;
    if (!email) {
      return reply.code(400).send({ error: 'Người dùng không có email để xác thực mật khẩu' });
    }

    const { error: signInError } = await request.server.supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      return reply.code(400).send({ error: 'Sai mật khẩu hiện tại' });
    }

    const { error: updateError } = await request.server.supabaseAdmin.auth.admin.updateUserById(
      id,
      { password: newPassword }
    );

    if (updateError) {
      request.log.error(updateError);
      return reply.code(400).send({ error: updateError.message });
    }

    return reply.code(200).send({ message: 'Cập nhật mật khẩu thành công' });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Lỗi máy chủ nội bộ' });
  }
};
