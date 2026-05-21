import { 
  localSignUp, 
  localSignIn, 
  localSignOut, 
  getLocalCurrentUser,
  onLocalAuthStateChange 
} from './localAuth';
import type { User } from '../../types';
import type { IAuthService } from '../../domain/contracts/IAuthService';

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ProdAuthService implements IAuthService {
  async signUp(email: string, password: string): Promise<User> {
    try {
      return await localSignUp(email, password);
    } catch (err) {
      throw new AuthError(
        err instanceof Error ? err.message : '注册失败，请重试',
        'SIGNUP_FAILED'
      );
    }
  }

  async signIn(email: string, password: string): Promise<User> {
    try {
      return await localSignIn(email, password);
    } catch (err) {
      throw new AuthError(
        err instanceof Error ? err.message : '登录失败，请重试',
        'SIGNIN_FAILED'
      );
    }
  }

  async signOut(): Promise<void> {
    localSignOut();
  }

  async getCurrentUser(): Promise<User | null> {
    return getLocalCurrentUser();
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    return onLocalAuthStateChange(callback);
  }

  async resetPassword(_email: string): Promise<void> {
    throw new AuthError('本地模式不支持密码重置', 'NOT_SUPPORTED');
  }

  async updatePassword(_newPassword: string): Promise<void> {
    throw new AuthError('本地模式暂不支持修改密码', 'NOT_SUPPORTED');
  }

  createGuestUser(): User {
    return {
      id: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email: '',
      isGuest: true,
      createdAt: new Date(),
    };
  }

  isGuestUser(user: User | null): boolean {
    return user?.isGuest ?? true;
  }
}
