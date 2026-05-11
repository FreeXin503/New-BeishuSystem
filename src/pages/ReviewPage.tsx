/**
 * 复习中心页面
 */

import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout';

export default function ReviewPage() {
  return (
    <AppLayout title="复习中心">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/wrong-answers"
            className="rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                  选择题错题本
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-secondary)' }}>
                  复习答错的选择题，标记掌握
                </p>
              </div>
              <span className="text-3xl">📕</span>
            </div>
          </Link>

          <Link
            to="/favorites"
            className="rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                  选择题收藏夹
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-secondary)' }}>
                  分类管理与回看收藏题
                </p>
              </div>
              <span className="text-3xl">⭐</span>
            </div>
          </Link>

          <Link
            to="/fill-blank-wrong-answers"
            className="rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                  填空题错题本
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-secondary)' }}>
                  错题复习 + 拼写练习
                </p>
              </div>
              <span className="text-3xl">🧩</span>
            </div>
          </Link>

          <Link
            to="/fill-blank-favorites"
            className="rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                  填空题收藏夹
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-secondary)' }}>
                  收藏题练习与分类管理
                </p>
              </div>
              <span className="text-3xl">✅</span>
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
