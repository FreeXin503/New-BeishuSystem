/**
 * 认证服务 - 使用依赖注入进行无缝 Mock 切换
 */

import { getService } from '../../lib/di';
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
  return getService('authService').signUp(email, password);
}

/**
 * 邮箱登录
 */
export async function signIn(email: string, password: string): Promise<User> {
  return getService('authService').signIn(email, password);
}

/**
 * 登出
 */
export async function signOut(): Promise<void> {
  return getService('authService').signOut();
}

/**
 * 获取当前用户
 */
export async function getCurrentUser(): Promise<User | null> {
  return getService('authService').getCurrentUser();
}

/**
 * 监听认证状态变化
 */
export function onAuthStateChange(
  callback: (user: User | null) => void
): () => void {
  return getService('authService').onAuthStateChange(callback);
}

/**
 * 重置密码
 */
export async function resetPassword(email: string): Promise<void> {
  return getService('authService').resetPassword(email);
}

/**
 * 更新密码
 */
export async function updatePassword(newPassword: string): Promise<void> {
  return getService('authService').updatePassword(newPassword);
}

/**
 * 创建游客用户
 */
export function createGuestUser(): User {
  return getService('authService').createGuestUser();
}

/**
 * 检查是否为游客
 */
export function isGuestUser(user: User | null): boolean {
  return getService('authService').isGuestUser(user);
}
