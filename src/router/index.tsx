/**
 * 路由配置
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// 加载组件
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
    </div>
  );
}

// 懒加载页面组件
const HomePage = lazy(() => import('../pages/HomePage'));
const ContentPage = lazy(() => import('../pages/ContentPage'));
const LearningPage = lazy(() => import('../pages/LearningPage'));
const StatisticsPage = lazy(() => import('../pages/StatisticsPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const QuizImportPage = lazy(() => import('../pages/QuizImportPage'));
const QuizPracticePage = lazy(() => import('../pages/QuizPracticePage'));
const WrongAnswersPage = lazy(() => import('../pages/WrongAnswersPage'));
const FavoritesPage = lazy(() => import('../pages/FavoritesPage'));
const TestPage = lazy(() => import('../pages/TestPage'));
const FillBlankPage = lazy(() => import('../pages/FillBlankPage'));
const FillBlankImportPage = lazy(() => import('../pages/FillBlankImportPage'));
const FillBlankPracticePage = lazy(() => import('../pages/FillBlankPracticePage'));
const FillBlankSpellPracticePage = lazy(() => import('../pages/FillBlankSpellPracticePage'));
const FillBlankFavoritesPage = lazy(() => import('../pages/FillBlankFavoritesPage'));
const FillBlankWrongAnswersPage = lazy(() => import('../pages/FillBlankWrongAnswersPage'));
const ReviewPage = lazy(() => import('../pages/ReviewPage'));
const SynoMasterPage = lazy(() => import('../pages/SynoMasterPage'));
const SynoFavoritesPage = lazy(() => import('../pages/SynoFavoritesPage'));
const SynoWrongBookPage = lazy(() => import('../pages/SynoWrongBookPage'));
const ChineseSpellingPage = lazy(() => import('../pages/ChineseSpellingPage'));

// 路由配置
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Suspense fallback={<LoadingFallback />}><HomePage /></Suspense>,
  },
  {
    path: '/content',
    element: <Suspense fallback={<LoadingFallback />}><ContentPage /></Suspense>,
  },
  {
    path: '/learning',
    element: <Suspense fallback={<LoadingFallback />}><LearningPage /></Suspense>,
  },
  {
    path: '/learning/:contentId',
    element: <Suspense fallback={<LoadingFallback />}><LearningPage /></Suspense>,
  },
  {
    path: '/statistics',
    element: <Suspense fallback={<LoadingFallback />}><StatisticsPage /></Suspense>,
  },
  {
    path: '/settings',
    element: <Suspense fallback={<LoadingFallback />}><SettingsPage /></Suspense>,
  },
  {
    path: '/login',
    element: <Suspense fallback={<LoadingFallback />}><LoginPage /></Suspense>,
  },
  {
    path: '/register',
    element: <Suspense fallback={<LoadingFallback />}><RegisterPage /></Suspense>,
  },
  {
    path: '/quiz-import',
    element: <Suspense fallback={<LoadingFallback />}><QuizImportPage /></Suspense>,
  },
  {
    path: '/quiz-practice',
    element: <Suspense fallback={<LoadingFallback />}><QuizPracticePage /></Suspense>,
  },
  {
    path: '/wrong-answers',
    element: <Suspense fallback={<LoadingFallback />}><WrongAnswersPage /></Suspense>,
  },
  {
    path: '/favorites',
    element: <Suspense fallback={<LoadingFallback />}><FavoritesPage /></Suspense>,
  },
  {
    path: '/review',
    element: <Suspense fallback={<LoadingFallback />}><ReviewPage /></Suspense>,
  },
  {
    path: '/test',
    element: <Suspense fallback={<LoadingFallback />}><TestPage /></Suspense>,
  },
  {
    path: '/fill-blank',
    element: <Suspense fallback={<LoadingFallback />}><FillBlankPage /></Suspense>,
  },
  {
    path: '/fill-blank-import',
    element: <Suspense fallback={<LoadingFallback />}><FillBlankImportPage /></Suspense>,
  },
  {
    path: '/fill-blank-practice',
    element: <Suspense fallback={<LoadingFallback />}><FillBlankPracticePage /></Suspense>,
  },
  {
    path: '/fill-blank-spell-practice',
    element: <Suspense fallback={<LoadingFallback />}><FillBlankSpellPracticePage /></Suspense>,
  },
  {
    path: '/fill-blank-favorites',
    element: <Suspense fallback={<LoadingFallback />}><FillBlankFavoritesPage /></Suspense>,
  },
  {
    path: '/fill-blank-wrong-answers',
    element: <Suspense fallback={<LoadingFallback />}><FillBlankWrongAnswersPage /></Suspense>,
  },
  {
    path: '/synomaster',
    element: <Suspense fallback={<LoadingFallback />}><SynoMasterPage /></Suspense>,
  },
  {
    path: '/syno-favorites',
    element: <Suspense fallback={<LoadingFallback />}><SynoFavoritesPage /></Suspense>,
  },
  {
    path: '/syno-wrongbook',
    element: <Suspense fallback={<LoadingFallback />}><SynoWrongBookPage /></Suspense>,
  },
  {
    path: '/chinese-spelling',
    element: <Suspense fallback={<LoadingFallback />}><ChineseSpellingPage /></Suspense>,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;
