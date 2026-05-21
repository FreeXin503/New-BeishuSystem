import type { IAuthService } from '../domain/contracts/IAuthService';
import type { ISpellingApi } from '../domain/contracts/ISpellingApi';
import type { IAIService } from '../domain/contracts/IAIService';

interface ServiceRegistry {
  authService: IAuthService;
  spellingApi: ISpellingApi;
  aiService: IAIService;
}

const registry: Partial<ServiceRegistry> = {};

export function registerService<K extends keyof ServiceRegistry>(
  key: K,
  instance: ServiceRegistry[K]
): void {
  registry[key] = instance;
}

export function getService<K extends keyof ServiceRegistry>(key: K): ServiceRegistry[K] {
  const instance = registry[key];
  if (!instance) {
    throw new Error(`Service ${key} is not registered in the DI container.`);
  }
  return instance;
}
