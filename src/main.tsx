import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';

// 导入依赖注入容器和各服务的具体实现
import { registerService } from './lib/di';
import { MockAuthService } from './api/mocks/mockAuthService';
import { MockSpellingApi } from './api/mocks/mockSpellingApi';
import { MockAIService } from './api/mocks/mockAIService';
import { ProdAuthService } from './services/auth/prodAuthService';
import { ProdSpellingApi } from './api/prodSpellingApi';
import { ProdAIService } from './services/ai/prodAIService';

// 读取环境变量与 localStorage，是否启用 Mock 沙盒
const useMock = localStorage.getItem('VITE_USE_MOCK') === 'true' || 
  (localStorage.getItem('VITE_USE_MOCK') === null && import.meta.env.VITE_USE_MOCK === 'true');

if (useMock) {
  console.log('[DI Container] Initializing Mock Sandbox...');
  registerService('authService', new MockAuthService());
  registerService('spellingApi', new MockSpellingApi());
  registerService('aiService', new MockAIService());
} else {
  console.log('[DI Container] Initializing Cloud/Production Services...');
  registerService('authService', new ProdAuthService());
  registerService('spellingApi', new ProdSpellingApi());
  registerService('aiService', new ProdAIService());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);

