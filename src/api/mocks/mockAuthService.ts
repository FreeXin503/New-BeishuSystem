import type { User } from '../../types';
import type { IAuthService } from '../../domain/contracts/IAuthService';

const MOCK_SESSION_KEY = 'mock-politics-auth-session';
const MOCK_USERS_KEY = 'mock-politics-users';

interface StoredMockUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export class MockAuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class MockAuthService implements IAuthService {
  private listeners: Set<(user: User | null) => void> = new Set();

  constructor() {
    // Listen to storage events to support multi-tab synchronization in mock mode
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === MOCK_SESSION_KEY) {
          const user = this.getSyncCurrentUser();
          this.notify(user);
        }
      });
    }
  }

  private getMockUsers(): StoredMockUser[] {
    const data = localStorage.getItem(MOCK_USERS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private saveMockUsers(users: StoredMockUser[]): void {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  }

  private notify(user: User | null): void {
    this.listeners.forEach(cb => cb(user));
  }

  private getSyncCurrentUser(): User | null {
    const sessionStr = localStorage.getItem(MOCK_SESSION_KEY);
    if (!sessionStr) return null;
    try {
      const session = JSON.parse(sessionStr);
      return {
        ...session,
        createdAt: new Date(session.createdAt),
      };
    } catch {
      return null;
    }
  }

  async signUp(email: string, password: string): Promise<User> {
    const users = this.getMockUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new MockAuthError('该邮箱已注册 (Mock)', 'SIGNUP_FAILED');
    }

    const now = new Date();
    const newUser: StoredMockUser = {
      id: `mock-user-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      email,
      passwordHash: `mock-hash-${password}`, // simple mock hash
      createdAt: now.toISOString(),
    };

    users.push(newUser);
    this.saveMockUsers(users);

    const user: User = {
      id: newUser.id,
      email: newUser.email,
      isGuest: false,
      createdAt: now,
    };

    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify({
      id: user.id,
      email: user.email,
      isGuest: user.isGuest,
      createdAt: user.createdAt.toISOString()
    }));

    this.notify(user);
    return user;
  }

  async signIn(email: string, password: string): Promise<User> {
    const users = this.getMockUsers();
    const userMatch = users.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === `mock-hash-${password}`
    );

    if (!userMatch) {
      throw new MockAuthError('邮箱或密码错误 (Mock)', 'SIGNIN_FAILED');
    }

    const user: User = {
      id: userMatch.id,
      email: userMatch.email,
      isGuest: false,
      createdAt: new Date(userMatch.createdAt),
    };

    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify({
      id: user.id,
      email: user.email,
      isGuest: user.isGuest,
      createdAt: user.createdAt.toISOString()
    }));

    this.notify(user);
    return user;
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(MOCK_SESSION_KEY);
    this.notify(null);
  }

  async getCurrentUser(): Promise<User | null> {
    return this.getSyncCurrentUser();
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.listeners.add(callback);
    // Execute immediately with the current state
    callback(this.getSyncCurrentUser());
    return () => {
      this.listeners.delete(callback);
    };
  }

  async resetPassword(_email: string): Promise<void> {
    throw new MockAuthError('本地模式不支持密码重置 (Mock)', 'NOT_SUPPORTED');
  }

  async updatePassword(_newPassword: string): Promise<void> {
    throw new MockAuthError('本地模式暂不支持修改密码 (Mock)', 'NOT_SUPPORTED');
  }

  createGuestUser(): User {
    return {
      id: `mock-guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email: '',
      isGuest: true,
      createdAt: new Date(),
    };
  }

  isGuestUser(user: User | null): boolean {
    return user?.isGuest ?? true;
  }
}
