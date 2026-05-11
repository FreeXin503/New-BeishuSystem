/**
 * 本地认证服务 - 使用 IndexedDB 存储用户数据
 */

import type { User } from '../../types';

const DB_NAME = 'politics-auth-db';
const DB_VERSION = 1;
const STORE_NAME = 'users';
const SESSION_KEY = 'politics-auth-session';

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

let db: IDBDatabase | null = null;

/**
 * 简单的密码哈希（生产环境应使用更安全的方案）
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'politics-study-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 打开数据库
 */
async function openDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('email', 'email', { unique: true });
      }
    };
  });
}

/**
 * 注册新用户
 */
export async function localSignUp(email: string, password: string): Promise<User> {
  const database = await openDatabase();
  
  // 检查邮箱是否已存在
  const existingUser = await new Promise<StoredUser | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('email');
    const request = index.get(email);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });

  if (existingUser) {
    throw new Error('该邮箱已注册');
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  
  const storedUser: StoredUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    email,
    passwordHash,
    createdAt: now.toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(storedUser);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  const user: User = {
    id: storedUser.id,
    email: storedUser.email,
    isGuest: false,
    createdAt: now,
  };

  // 保存会话
  saveSession(user);

  return user;
}

/**
 * 登录
 */
export async function localSignIn(email: string, password: string): Promise<User> {
  const database = await openDatabase();
  
  const storedUser = await new Promise<StoredUser | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('email');
    const request = index.get(email);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });

  if (!storedUser) {
    throw new Error('邮箱或密码错误');
  }

  const passwordHash = await hashPassword(password);
  if (passwordHash !== storedUser.passwordHash) {
    throw new Error('邮箱或密码错误');
  }

  const user: User = {
    id: storedUser.id,
    email: storedUser.email,
    isGuest: false,
    createdAt: new Date(storedUser.createdAt),
  };

  // 保存会话
  saveSession(user);

  return user;
}

/**
 * 登出
 */
export function localSignOut(): void {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * 获取当前用户
 */
export function getLocalCurrentUser(): User | null {
  const sessionStr = localStorage.getItem(SESSION_KEY);
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

/**
 * 保存会话
 */
function saveSession(user: User): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    id: user.id,
    email: user.email,
    isGuest: user.isGuest,
    createdAt: user.createdAt.toISOString(),
  }));
}

/**
 * 监听存储变化（跨标签页同步）
 */
export function onLocalAuthStateChange(callback: (user: User | null) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === SESSION_KEY) {
      callback(getLocalCurrentUser());
    }
  };
  
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
