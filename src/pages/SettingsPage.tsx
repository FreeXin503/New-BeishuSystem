import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeStore } from '../stores/useThemeStore';
import { useUserStore } from '../stores/useUserStore';
import { signOut } from '../services/auth/authService';
import { getDefaultSettings, getGuestSettings, saveGuestSettings } from '../services/storage/guestMode';
import { clearAllCaches, getCacheSize } from '../services/offline/offlineManager';
import type { Theme, UserSettings } from '../types';

const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: '☀' },
  { value: 'dark', label: '深色', icon: '🌙' },
  { value: 'eye-care', label: '护眼', icon: '🌿' },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();
  const { user, isGuest, logout } = useUserStore();

  const [settings, setSettings] = useState<UserSettings>(getDefaultSettings());
  const [cacheSize, setCacheSize] = useState('计算中...');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadSettings();
    void loadCacheSize();
  }, []);

  async function loadSettings() {
    const saved = await getGuestSettings();
    if (saved) setSettings(saved);
  }

  async function loadCacheSize() {
    const size = await getCacheSize();
    setCacheSize(formatBytes(size));
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      await saveGuestSettings(settings);
    } catch (error) {
      console.error('保存设置失败:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearCache() {
    if (!window.confirm('确定要清除所有缓存吗？')) return;
    await clearAllCaches();
    setCacheSize('0 B');
  }

  async function handleLogout() {
    try {
      if (!isGuest) {
        await signOut();
      }
      logout();
      navigate('/');
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Link
              to="/"
              className="mr-4 rounded-full p-2 hover:opacity-80"
              style={{ backgroundColor: 'var(--color-bg)' }}
            >
              <svg className="h-6 w-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              设置
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="rounded-lg p-6 shadow" style={{ backgroundColor: 'var(--color-card)' }}>
            <h2 className="mb-4 text-lg font-medium" style={{ color: 'var(--color-text)' }}>
              账户信息
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--color-secondary)' }}>账户类型</span>
                <span style={{ color: 'var(--color-text)' }}>{isGuest ? '游客模式' : '已登录'}</span>
              </div>
              {!isGuest && user?.email && (
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--color-secondary)' }}>邮箱</span>
                  <span style={{ color: 'var(--color-text)' }}>{user.email}</span>
                </div>
              )}
              {isGuest ? (
                <Link
                  to="/login"
                  className="block w-full rounded-lg px-4 py-2 text-center text-white hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  登录账户
                </Link>
              ) : (
                <button
                  onClick={handleLogout}
                  className="w-full rounded-lg px-4 py-2 text-white hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-error)' }}
                >
                  退出登录
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg p-6 shadow" style={{ backgroundColor: 'var(--color-card)' }}>
            <h2 className="mb-4 text-lg font-medium" style={{ color: 'var(--color-text)' }}>
              外观设置
            </h2>
            <span className="mb-3 block" style={{ color: 'var(--color-text)' }}>
              主题模式
            </span>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex flex-col items-center rounded-lg border-2 p-4 transition-all ${
                    theme === option.value ? 'border-opacity-100' : 'border-opacity-30'
                  }`}
                  style={{
                    borderColor: theme === option.value ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: theme === option.value ? 'var(--color-bg)' : 'transparent',
                  }}
                >
                  <span className="mb-2 text-2xl">{option.icon}</span>
                  <span style={{ color: 'var(--color-text)' }}>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-6 shadow" style={{ backgroundColor: 'var(--color-card)' }}>
            <h2 className="mb-4 text-lg font-medium" style={{ color: 'var(--color-text)' }}>
              学习设置
            </h2>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span style={{ color: 'var(--color-text)' }}>语音语速</span>
                  <span style={{ color: 'var(--color-secondary)' }}>{settings.speechRate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.speechRate}
                  onChange={(e) => setSettings({ ...settings, speechRate: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span style={{ color: 'var(--color-text)' }}>每日学习目标</span>
                  <span style={{ color: 'var(--color-secondary)' }}>{settings.dailyGoal} 分钟</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="5"
                  value={settings.dailyGoal}
                  onChange={(e) => setSettings({ ...settings, dailyGoal: parseInt(e.target.value, 10) })}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span style={{ color: 'var(--color-text)' }}>复习提醒</span>
                  <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                    开启后会在有待复习内容时提醒你
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled })}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: settings.notificationsEnabled ? 'var(--color-primary)' : 'var(--color-border)',
                  }}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full rounded-lg px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>

          <div className="rounded-lg p-6 shadow" style={{ backgroundColor: 'var(--color-card)' }}>
            <h2 className="mb-4 text-lg font-medium" style={{ color: 'var(--color-text)' }}>
              存储设置
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--color-secondary)' }}>缓存大小</span>
                <span style={{ color: 'var(--color-text)' }}>{cacheSize}</span>
              </div>
              <button
                onClick={handleClearCache}
                className="w-full rounded-lg border px-4 py-2 hover:opacity-80"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                清除缓存
              </button>
            </div>
          </div>

          <div className="rounded-lg p-6 shadow" style={{ backgroundColor: 'var(--color-card)' }}>
            <h2 className="mb-4 text-lg font-medium" style={{ color: 'var(--color-text)' }}>
              关于
            </h2>
            <div className="space-y-2 text-sm" style={{ color: 'var(--color-secondary)' }}>
              <p>智能背诵工具库 v1.0.0</p>
              <p>基于 AI 的学习工具，帮助你高效记忆。</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
