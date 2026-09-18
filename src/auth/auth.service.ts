import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AppConfig } from '../config/app-config';
interface User {
  _id: string;
  email: string;
  salt: string;
  passwordHash: string;
}
export interface Session {
  _id: string;
  ownerId: string;
  email: string;
  csrfToken: string;
  expiresAt: Date;
}
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: AppConfig,
  ) {}
  private digest(token: string) {
    return createHmac('sha256', this.config.values.SESSION_SECRET)
      .update(token)
      .digest('hex');
  }
  async register(email: string, password: string) {
    const salt = randomBytes(16).toString('hex');
    const user: User = {
      _id: randomUUID(),
      email,
      salt,
      passwordHash: (await derive(password, salt)).toString('hex'),
    };
    try {
      await this.database.db.collection<User>('users').insertOne(user);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === 11000
      )
        throw new ConflictException('Unable to register this email');
      throw error;
    }
    return this.createSession(user);
  }
  async login(email: string, password: string) {
    const user = await this.database.db
      .collection<User>('users')
      .findOne({ email });
    const candidate = await derive(
      password,
      user?.salt ?? '00000000000000000000000000000000',
    );
    const expected = Buffer.from(user?.passwordHash ?? '00'.repeat(64), 'hex');
    if (!timingSafeEqual(candidate, expected) || !user)
      throw new UnauthorizedException('Invalid email or password');
    return this.createSession(user);
  }
  private async createSession(user: User) {
    const token = randomBytes(32).toString('hex');
    const session: Session = {
      _id: this.digest(token),
      ownerId: user._id,
      email: user.email,
      csrfToken: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    };
    await this.database.db.collection<Session>('sessions').insertOne(session);
    return { token, session };
  }
  async session(token: string | undefined) {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Sign in to continue');
    const session = await this.database.db
      .collection<Session>('sessions')
      .findOne({ _id: this.digest(token), expiresAt: { $gt: new Date() } });
    if (!session)
      throw new UnauthorizedException('Session expired; sign in again');
    return session;
  }
  async logout(id: string) {
    await this.database.db
      .collection<Session>('sessions')
      .deleteOne({ _id: id });
  }
}
