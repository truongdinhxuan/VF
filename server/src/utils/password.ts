import {
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const HASH_PREFIX = 'scrypt';

export const PASSWORD_RULE_MESSAGE =
  'Mật khẩu phải dài 9-128 ký tự và có ít nhất một chữ hoa, một chữ số, một ký tự đặc biệt';

export const isStrongPassword = (password: string): boolean =>
  password.length >= 9 &&
  password.length <= 128 &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const deriveKey = (password: string, salt: Buffer, keyLength = KEY_LENGTH) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(password, salt);

  return [
    HASH_PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
};

export const verifyPassword = async (
  password: string,
  encodedHash: string,
): Promise<boolean> => {
  const [algorithm, n, r, p, encodedSalt, encodedKey, ...extra] =
    encodedHash.split('$');

  if (
    algorithm !== HASH_PREFIX ||
    Number(n) !== SCRYPT_N ||
    Number(r) !== SCRYPT_R ||
    Number(p) !== SCRYPT_P ||
    !encodedSalt ||
    !encodedKey ||
    extra.length > 0
  ) {
    return false;
  }

  try {
    const expectedKey = Buffer.from(encodedKey, 'base64url');
    if (expectedKey.length !== KEY_LENGTH) return false;

    const actualKey = await deriveKey(
      password,
      Buffer.from(encodedSalt, 'base64url'),
      expectedKey.length,
    );

    return timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
};
