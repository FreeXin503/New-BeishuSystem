/**
 * 系统设置中心 - SettingsPage.tsx
 * 像素级对齐原型 `id="page-settings"` 的企业级偏好与环境沙盒中控室
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeStore } from '../stores/useThemeStore';
import { useUserStore } from '../stores/useUserStore';
import { useToast } from '../components/ui';
import { signOut } from '../services/auth/authService';
import { getDefaultSettings, getGuestSettings, saveGuestSettings } from '../services/storage/guestMode';
import { clearAllCaches, getCacheSize } from '../services/offline/offlineManager';
import { AppLayout } from '../components/layout';
import type { Theme, UserSettings } from '../types';

const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: '简约浅色', icon: '☀' },
  { value: 'dark', label: '深邃暗夜', icon: '🌙' },
  { value: 'eye-care', label: '复古护眼', icon: '🌿' },
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
  const toast = useToast();
  const { theme, setTheme } = useThemeStore();
  const { user, isGuest, logout } = useUserStore();

  const [settings, setSettings] = useState<UserSettings>(getDefaultSettings());
  const [cacheSize, setCacheSize] = useState('计算中...');
  const [saving, setSaving] = useState(false);

  // 沙盒 Mock 环境开关状态 (从 localStorage 读取 override，或 fallback 到环境默认配置)
  const [sandboxEnabled, setSandboxEnabled] = useState(() => {
    const override = localStorage.getItem('VITE_USE_MOCK');
    if (override !== null) {
      return override === 'true';
    }
    return import.meta.env.VITE_USE_MOCK === 'true';
  });

  const [showReloadTip, setShowReloadTip] = useState(false);

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
      toast.success('学习因子与提醒设置已持久化保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      toast.error('保存设置失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  // 切换独立沙盒环境网关
  const handleToggleSandbox = (checked: boolean) => {
    setSandboxEnabled(checked);
    localStorage.setItem('VITE_USE_MOCK', checked ? 'true' : 'false');
    setShowReloadTip(true);
    toast.success(
      checked
        ? '已激活离线沙盒网关！需刷新以注入 Mock 服务。'
        : '已指向云端生产环境网关！需刷新以重新激活连接。'
    );
  };

  const handleRefreshApp = () => {
    window.location.reload();
  };

  async function handleClearCache() {
    if (!window.confirm('确定要清除所有本地脱机缓存吗？这将清除已缓存的语料库音频。')) return;
    await clearAllCaches();
    setCacheSize('0 B');
    toast.success('脱机缓存数据已彻底排空');
  }

  async function handleLogout() {
    try {
      if (!isGuest) {
        await signOut();
      }
      logout();
      toast.success('已安全退出当前会话账户');
      navigate('/');
    } catch (error) {
      console.error('退出登录失败:', error);
      toast.error('退出失败，请稍后重试');
    }
  }

  return (
    <AppLayout title="系统配置中心">
      <div className="page-fade-in p-8 md:p-12 max-w-4xl mx-auto space-y-10">
        
        {/* 通栏标题 */}
        <header className="border-b border-slate-200/60 pb-8">
          <h2 className="text-4xl font-bold tracking-tight text-slate-900">系统配置中心</h2>
          <p className="text-slate-500 mt-2 text-sm">自适应外观、记忆因子阀门与依赖注入环境网关微调</p>
        </header>

        {/* 核心重写：独立沙盒环境网关契约大卡片 */}
        <div
          className={`rounded-master p-8 border transition-all relative overflow-hidden ${
            sandboxEnabled
              ? 'border-brand-primary bg-indigo-50/10 shadow-master-card'
              : 'border-workspace-border bg-white shadow-panel-flat'
          }`}
        >
          {/* 光晕模糊背景 */}
          {sandboxEnabled && (
            <div className="absolute -right-10 -bottom-10 h-32 w-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">独立沙盒环境网关契约</h3>
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    sandboxEnabled
                      ? 'bg-indigo-100 text-brand-primary border border-indigo-200/50'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sandboxEnabled ? 'Sandbox Active' : 'Cloud Production'}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                开启后，系统将彻底切断一切外部Supabase网络请求与云端接口，在前端DI（Dependency Injection）依赖注入层全局注入全量 Mock 契约沙盒（包含假数据、AI切题与同义词生成），保证系统离线100%全功能流畅流转。
              </p>
            </div>

            {/* 开关开关 Toggle */}
            <button
              onClick={() => handleToggleSandbox(!sandboxEnabled)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors active:scale-90 ${
                sandboxEnabled ? 'bg-brand-primary' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  sandboxEnabled ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 立即刷新应用程序悬浮条 */}
          {showReloadTip && (
            <div className="mt-6 p-4 bg-amber-50 text-feedback-warning border border-amber-200/60 rounded-2xl flex items-center justify-between text-xs font-bold animate-fade-in">
              <span>⚠️ 网关切换策略已预写，必须重新加载应用程序以生效契约</span>
              <button
                onClick={handleRefreshApp}
                className="px-4 py-2 rounded-xl bg-feedback-warning text-white font-bold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-amber-600/10"
              >
                立即刷新应用
              </button>
            </div>
          )}
        </div>

        {/* 外观设置大卡片 */}
        <div className="bg-white rounded-master p-8 border border-workspace-border shadow-panel-flat space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">外观设计语义</h3>
            <p className="text-xs text-slate-400 mt-1">切换系统核心设计配色方案，对齐精美大厂设计标准</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {themeOptions.map((option) => {
              const isSelected = theme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 p-5 transition-all hover:-translate-y-0.5 active:scale-95 ${
                    isSelected
                      ? 'border-brand-primary bg-indigo-50/10'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <span className="mb-2 text-3xl">{option.icon}</span>
                  <span className={`text-xs font-bold ${isSelected ? 'text-brand-primary font-black' : 'text-slate-500'}`}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 学习设置大卡片 */}
        <div className="bg-white rounded-master p-8 border border-workspace-border shadow-panel-flat space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">记忆遗忘因子设置</h3>
            <p className="text-xs text-slate-400 mt-1">微调背诵语音播放速率、日常专注阈值与推送开关</p>
          </div>

          <div className="space-y-6">
            {/* 语速滑块 */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">背诵音频朗读语速</span>
                <span className="text-brand-primary">{settings.speechRate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.speechRate}
                onChange={(e) => setSettings({ ...settings, speechRate: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* 每日学习目标滑块 */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">每日有效专注时长目标</span>
                <span className="text-brand-primary">{settings.dailyGoal} 分钟</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={settings.dailyGoal}
                onChange={(e) => setSettings({ ...settings, dailyGoal: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* 推送通知切换 */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <h4 className="text-sm font-bold text-slate-800">SM2 记忆复习定时提醒</h4>
                <p className="text-xs text-slate-400 mt-0.5">当发生局部记忆超期过载预警时在通知栏推送提醒</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-90 ${
                  settings.notificationsEnabled ? 'bg-brand-primary' : 'bg-slate-200'
                }`}
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
              className="w-full py-4 rounded-[20px] bg-slate-900 text-white font-bold text-sm shadow-xl hover:bg-slate-800 active:scale-95 transition-all"
            >
              {saving ? '正在保存偏好...' : '保存背诵偏好因子'}
            </button>
          </div>
        </div>

        {/* 脱机存储大小卡片 */}
        <div className="bg-white rounded-master p-8 border border-workspace-border shadow-panel-flat space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">脱机存储缓存控制</h3>
            <p className="text-xs text-slate-400 mt-1">排查与清理无用的静态语音缓存，释放您的本地沙盒空间</p>
          </div>

          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-600">已使用脱机空间大小</span>
            <span className="text-brand-primary bg-indigo-50 px-3 py-1 rounded-lg">{cacheSize}</span>
          </div>

          <button
            onClick={handleClearCache}
            className="w-full py-4 rounded-[20px] border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm active:scale-95 transition-all"
          >
            排空所有脱机缓存空间
          </button>
        </div>

        {/* 账户安全卡片 */}
        <div className="bg-white rounded-master p-8 border border-workspace-border shadow-panel-flat space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">账户信息</h3>
            <p className="text-xs text-slate-400 mt-1">管理当前会话账户的状态信息</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600">会话账户类型</span>
              <span className="text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">
                {isGuest ? 'Client Guest Mode (访客独立沙盒)' : 'Cloud Synchronized (已同步账户)'}
              </span>
            </div>
            {!isGuest && user?.email && (
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">注册主板邮箱</span>
                <span className="text-slate-800">{user.email}</span>
              </div>
            )}
            {isGuest ? (
              <Link
                to="/login"
                className="block w-full py-4 text-center rounded-[20px] bg-brand-primary text-white font-bold text-sm shadow-xl shadow-indigo-600/10 hover:bg-indigo-700 active:scale-95 transition-all"
              >
                立即登录 / 升级为云同步主板
              </Link>
            ) : (
              <button
                onClick={handleLogout}
                className="w-full py-4 rounded-[20px] bg-rose-50 text-feedback-error border border-rose-100 hover:bg-rose-100 font-bold text-sm active:scale-95 transition-all"
              >
                退出当前登录会话
              </button>
            )}
          </div>
        </div>

        {/* 关于信息 */}
        <div className="text-center text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none pt-4">
          RecitationMaster Enterprise Suite v2.0
        </div>
      </div>
    </AppLayout>
  );
}
