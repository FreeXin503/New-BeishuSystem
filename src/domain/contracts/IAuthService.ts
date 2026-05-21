import type { User } from '../../types';

export interface IAuthService {
  signUp(email: string, password: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  onAuthStateChange(callback: (user: User | null) => void): () => void;
  resetPassword(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  createGuestUser(): User;
  isGuestUser(user: User | null): boolean;
}
