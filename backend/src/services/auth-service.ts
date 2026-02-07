import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { FastifyInstance } from 'fastify';
import { AppConfig } from '../config/env.js';
import { PublicUser, UserRecord, UserRole } from '../domain/types.js';
import { AppError } from '../shared/app-error.js';
import { StoreRepository } from '../infrastructure/store/store-repository.js';

interface RegisterInput {
  email: string;
  displayName: string;
  password: string;
  role?: UserRole;
}

interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();
type JwtSigner = FastifyInstance['jwt'];

export class AuthService {
  constructor(
    private readonly repository: StoreRepository,
    private readonly jwt: JwtSigner,
    private readonly config: AppConfig,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const now = new Date().toISOString();
    const existing = await this.repository.findUserByEmail(email);
    if (existing) throw new AppError('E-mail já cadastrado.', 409, 'CONFLICT');

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user: UserRecord = {
      id: nanoid(),
      email,
      displayName: input.displayName.trim(),
      passwordHash,
      role: input.role ?? 'PLAYER',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };

    await this.repository.createUser(user);
    return this.issueToken(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const user = await this.repository.findUserByEmail(email);
    if (!user) {
      await this.repository.incrementAuthFailures();
      throw new AppError('Credenciais inválidas.', 401, 'UNAUTHORIZED');
    }

    const passwordIsValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordIsValid) {
      await this.repository.incrementAuthFailures();
      throw new AppError('Credenciais inválidas.', 401, 'UNAUTHORIZED');
    }

    await this.repository.updateUserLogin(user.id, new Date().toISOString());
    const refreshedUser = await this.repository.findUserById(user.id);
    if (!refreshedUser) throw new AppError('Usuário não encontrado após login.', 404, 'NOT_FOUND');
    return this.issueToken(refreshedUser);
  }

  async findPublicUser(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) return null;
    return this.repository.getPublicUser(user);
  }

  async bootstrapAdmin(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.repository.findUserByEmail(normalizedEmail);
    if (existing) return;
    await this.register({
      email: normalizedEmail,
      displayName: 'Administrator',
      password,
      role: 'ADMIN',
    });
  }

  private issueToken(user: UserRecord): AuthResult {
    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        expiresIn: this.config.accessTokenTtlSeconds,
      },
    );

    return {
      user: this.repository.getPublicUser(user),
      accessToken,
      tokenType: 'Bearer',
      expiresInSeconds: this.config.accessTokenTtlSeconds,
    };
  }
}
