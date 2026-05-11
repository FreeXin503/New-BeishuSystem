/**
 * 认证服务 - 使用本地存储
 */

import { 
  localSignUp, 
  localSignIn, 
  localSignOut, 
  getLocalCurrentUser,
  onLocalAuthStateChange 
} from './localAuth';
import type { User } from '../../types';

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * 邮箱注册
 */
export async function signUp(email: string, password: string): Promise<User> {
  try {
    return await localSignUp(email, password);
  } catch (err) {
    throw new AuthError(
      err instanceof Error ? err.message : '注册失败，请重试',
      'SIGNUP_FAILED'
    );
  }
}

/**
 * 邮箱登录
 */
export async function signIn(email: string, password: string): Promise<User> {
  try {
    return await localSignIn(email, password);
  } catch (err) {
    throw new AuthError(
      err instanceof Error ? err.message : '登录失败，请重试',
      'SIGNIN_FAILED'
    );
  }
}

/**
 * 登出
 */
export async function signOut(): Promise<void> {
  localSignOut();
}

/**
 * 获取当前用户
 */
export async function getCurrentUser(): Promise<User | null> {
  return getLocalCurrentUser();
}

/**
 * 监听认证状态变化
 */
export function onAuthStateChange(
  callback: (user: User | null) => void
): () => void {
  return onLocalAuthStateChange(callback);
}

/**
 * 重置密码（本地模式不支持）
 */
export async function resetPassword(_email: string): Promise<void> {
  throw new AuthError('本地模式不支持密码重置', 'NOT_SUPPORTED');
}

/**
 * 更新密码（本地模式暂不支持）
 */
export async function updatePassword(_newPassword: string): Promise<void> {
  throw new AuthError('本地模式暂不支持修改密码', 'NOT_SUPPORTED');
}

/**
 * 创建游客用户
 */
export function createGuestUser(): User {
  return {
    id: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email: '',
    isGuest: true,
    createdAt: new Date(),
  };
}

/**
 * 检查是否为游客
 */
export function isGuestUser(user: User | null): boolean {
  return user?.isGuest ?? true;
}
