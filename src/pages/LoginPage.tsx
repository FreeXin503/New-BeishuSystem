/**
 * 登录页面
 */

import { Link, useNavigate } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import { useUserStore } from '../stores/useUserStore';
import { getOrCreateGuestUser } from '../services/storage/guestMode';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setIsGuest } = useUserStore();

  function handleSuccess() {
    navigate('/');
  }

  function handleGuestMode() {
    const guestUser = getOrCreateGuestUser();
    setUser(guestUser);
    setIsGuest(true);
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center">
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            智能政治背诵系统
          </h1>
        </Link>
        <h2 className="mt-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
          登录账户
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          还没有账户？{' '}
          <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
            立即注册
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <LoginForm
            onSuccess={handleSuccess}
            onSwitchToRegister={() => navigate('/register')}
            onGuestMode={handleGuestMode}
          />
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  或者
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGuestMode}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                以游客身份继续
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
