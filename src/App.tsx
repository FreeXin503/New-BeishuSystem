import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router/index';
import { useThemeStore } from './stores/useThemeStore';
import { useUserStore } from './stores/useUserStore';
import { initOfflineManager, registerServiceWorker } from './services/offline/offlineManager';
import { getOrCreateGuestUser } from './services/storage/guestMode';

function App() {
  const { theme } = useThemeStore();
  const { setUser, setIsGuest } = useUserStore();

  useEffect(() => {
    // 初始化离线管理器
    initOfflineManager();
    
    // 注册 Service Worker
    registerServiceWorker();
    
    // 初始化用户（游客模式）
    initUser();
  }, []);

  async function initUser() {
    try {
      // 检查是否有已登录用户
      const { getCurrentUser } = await import('./services/auth/authService');
      const user = await getCurrentUser();
      
      if (user) {
        setUser(user);
        setIsGuest(false);
      } else {
        // 使用游客模式
        const guestUser = getOrCreateGuestUser();
        setUser(guestUser);
        setIsGuest(true);
      }
    } catch {
      // 出错时使用游客模式
      const guestUser = getOrCreateGuestUser();
      setUser(guestUser);
      setIsGuest(true);
    }
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
