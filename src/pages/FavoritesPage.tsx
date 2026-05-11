import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { FavoriteCategory, FavoriteQuestion, FavoriteStats } from '../types';
import {
  createFavoriteCategory,
  getFavoriteCategories,
  getFavoriteStats,
  removeFavorite,
  removeFavoriteCategory,
  updateFavoriteCategory,
  updateFavoriteCategoryInfo,
} from '../services/learning/favorite';
import { getAllFavorites, getFavoritesByCategory } from '../services/storage/indexedDB';
import { getOptionLabel } from '../services/learning/quiz';
import { useToast } from '../components/ui';
import { trackEvent } from '../services/statistics/eventTracker';

type ViewMode = 'stats' | 'list';

const sortFavorites = (items: FavoriteQuestion[]) =>
  [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export default function FavoritesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('stats');
  const [stats, setStats] = useState<FavoriteStats[]>([]);
  const [favorites, setFavorites] = useState<FavoriteQuestion[]>([]);
  const [categories, setCategories] = useState<FavoriteCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FavoriteCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');
  const [categoryColor, setCategoryColor] = useState('#3b82f6');

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingFavorite, setMovingFavorite] = useState<FavoriteQuestion | null>(null);
  const [entryMessage, setEntryMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const navState = location.state as
      | {
          openCategory?: string;
          openList?: boolean;
          fromWrongAnswers?: boolean;
          addedCount?: number;
        }
      | null;

    if (!navState?.openList) return;

    const category = navState.openCategory || 'default';
    handleFilterByCategory(category).then(() => {
      setViewMode('list');
      if (navState.fromWrongAnswers && navState.addedCount) {
        setEntryMessage(`已从错题加入收藏 ${navState.addedCount} 题`);
        trackEvent('favorites_entry_success', { source: 'wrong_answers', added: navState.addedCount });
      }
      navigate('.', { replace: true, state: null });
    });
  }, [location.state]);

  async function loadData() {
    setLoading(true);
    try {
      const [statsData, categoryData, allFavorites] = await Promise.all([
        getFavoriteStats(),
        getFavoriteCategories(),
        getAllFavorites(),
      ]);

      setStats(statsData);
      setCategories(categoryData);
      setFavorites(sortFavorites(allFavorites));
    } catch (error) {
      console.error('加载收藏数据失败:', error);
      toast.error('加载收藏失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleFilterByCategory(category: string | null) {
    setSelectedCategory(category);
    setLoading(true);
    try {
      if (!category) {
        const all = await getAllFavorites();
        setFavorites(sortFavorites(all));
      } else {
        const filtered = await getFavoritesByCategory(category);
        setFavorites(sortFavorites(filtered));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(questionId: string) {
    if (!confirm('确定要取消收藏这道题吗？')) return;

    await removeFavorite(questionId);
    toast.success('已取消收藏');
    trackEvent('favorites_remove_success', { questionId });

    await loadData();
    if (selectedCategory) {
      await handleFilterByCategory(selectedCategory);
    }
  }

  function openAddCategory() {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDesc('');
    setCategoryColor('#3b82f6');
    setShowCategoryModal(true);
  }

  function openEditCategory(category: FavoriteCategory) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDesc(category.description || '');
    setCategoryColor(category.color || '#3b82f6');
    setShowCategoryModal(true);
  }

  async function handleSaveCategory() {
    if (!categoryName.trim()) {
      toast.warning('请输入分类名称');
      return;
    }

    if (editingCategory) {
      await updateFavoriteCategoryInfo(editingCategory.id, {
        name: categoryName.trim(),
        description: categoryDesc.trim() || undefined,
        color: categoryColor,
      });
      toast.success('分类已更新');
      trackEvent('favorites_category_success', { action: 'update' });
    } else {
      await createFavoriteCategory(categoryName.trim(), categoryDesc.trim() || undefined, categoryColor);
      toast.success('分类已创建');
      trackEvent('favorites_category_success', { action: 'create' });
    }

    setShowCategoryModal(false);
    await loadData();
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('删除分类后，该分类下收藏会移到默认分类。确认删除吗？')) return;

    await removeFavoriteCategory(id);
    toast.success('分类已删除并迁移到默认分类');
    trackEvent('favorites_category_success', { action: 'delete' });
    await loadData();
  }

  function openMoveModal(item: FavoriteQuestion) {
    setMovingFavorite(item);
    setShowMoveModal(true);
  }

  async function handleMove(categoryId: string) {
    if (!movingFavorite) return;

    await updateFavoriteCategory(movingFavorite.questionId, categoryId);
    setShowMoveModal(false);
    setMovingFavorite(null);
    toast.success('分类已更新');
    trackEvent('favorites_move_success', { to: categoryId });

    await loadData();
    if (selectedCategory) {
      await handleFilterByCategory(selectedCategory);
    }
  }

  function getCategoryName(categoryId: string) {
    if (categoryId === 'default') return '默认分类';
    const category = categories.find((item) => item.id === categoryId);
    return category?.name || categoryId;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div
          className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg p-6 max-w-sm w-full" style={{ backgroundColor: 'var(--color-card)' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>
              {editingCategory ? '编辑分类' : '新建分类'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>分类名称</label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                  placeholder="输入分类名称"
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>描述（可选）</label>
                <input
                  type="text"
                  value={categoryDesc}
                  onChange={(event) => setCategoryDesc(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                  placeholder="输入分类描述"
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>颜色</label>
                <div className="flex gap-2">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setCategoryColor(color)}
                      className="w-8 h-8 rounded-full"
                      style={{
                        backgroundColor: color,
                        border: categoryColor === color ? '3px solid var(--color-text)' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
              >
                取消
              </button>
              <button
                onClick={handleSaveCategory}
                className="flex-1 py-2 rounded-lg text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveModal && movingFavorite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg p-6 max-w-sm w-full" style={{ backgroundColor: 'var(--color-card)' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>
              移动到分类
            </h3>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              <button
                onClick={() => handleMove('default')}
                className="w-full text-left px-4 py-3 rounded-lg"
                style={{
                  backgroundColor:
                    movingFavorite.category === 'default' ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: movingFavorite.category === 'default' ? '#ffffff' : 'var(--color-text)',
                }}
              >
                默认分类
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleMove(category.id)}
                  className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-2"
                  style={{
                    backgroundColor:
                      movingFavorite.category === category.id ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: movingFavorite.category === category.id ? '#ffffff' : 'var(--color-text)',
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color || '#3b82f6' }}
                  />
                  {category.name}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowMoveModal(false)}
              className="w-full mt-4 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/quiz-import" className="mr-4 p-2 rounded-full hover:opacity-80">
                <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>收藏夹</h1>
            </div>

            <button
              onClick={openAddCategory}
              className="px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              + 新建分类
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {entryMessage && (
          <div
            className="mb-4 rounded-lg border px-4 py-3 flex items-center justify-between"
            style={{
              backgroundColor: 'rgba(16,185,129,0.1)',
              borderColor: 'var(--color-success)',
            }}
          >
            <span className="text-sm" style={{ color: 'var(--color-text)' }}>{entryMessage}</span>
            <button
              onClick={() => setEntryMessage(null)}
              className="px-2 py-1 rounded text-xs"
              style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)' }}
            >
              关闭
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-card)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{favorites.length}</p>
            <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>总收藏</p>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-card)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{categories.length + 1}</p>
            <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>分类数</p>
          </div>
        </div>

        {viewMode === 'stats' && (
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-3" style={{ color: 'var(--color-text)' }}>分类管理</h2>
            <div className="space-y-2">
              <div
                className="p-4 rounded-lg flex justify-between items-center"
                style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
              >
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => {
                    handleFilterByCategory('default');
                    setViewMode('list');
                  }}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6b7280' }} />
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>默认分类</h3>
                    <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                      {stats.find((item) => item.category === 'default')?.count || 0} 题
                    </p>
                  </div>
                </div>
                <span style={{ color: 'var(--color-secondary)' }}>›</span>
              </div>

              {categories.map((category) => (
                <div
                  key={category.id}
                  className="p-4 rounded-lg flex justify-between items-center"
                  style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => {
                      handleFilterByCategory(category.id);
                      setViewMode('list');
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color || '#3b82f6' }}
                    />
                    <div>
                      <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>{category.name}</h3>
                      <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                        {stats.find((item) => item.category === category.id)?.count || 0} 题
                        {category.description ? ` · ${category.description}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditCategory(category)} className="p-2 rounded hover:opacity-80">编辑</button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-2 rounded hover:opacity-80"
                      style={{ color: 'var(--color-error)' }}
                    >
                      删除
                    </button>
                    <span style={{ color: 'var(--color-secondary)' }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => {
                  setViewMode('stats');
                  setSelectedCategory(null);
                }}
                className="px-3 py-1 rounded text-sm"
                style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)' }}
              >
                ← 返回
              </button>
              <span className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                {selectedCategory ? getCategoryName(selectedCategory) : '全部'} ({favorites.length} 题)
              </span>
            </div>

            <div className="space-y-4">
              {favorites.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--color-secondary)' }}>
                  暂无收藏题目
                </div>
              ) : (
                favorites.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg"
                    style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                            {item.question.question}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                            {getCategoryName(item.category)}
                          </p>
                        </div>
                        <svg
                          className={`w-5 h-5 transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`}
                          style={{ color: 'var(--color-secondary)' }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {expandedId === item.id && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="pt-4 space-y-2">
                          {item.question.options.map((option, idx) => {
                            const isCorrect = option === item.question.correctAnswer;
                            return (
                              <div
                                key={idx}
                                className="px-3 py-2 rounded text-sm"
                                style={{
                                  backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg)',
                                  color: isCorrect ? 'var(--color-success)' : 'var(--color-text)',
                                  border: `1px solid ${isCorrect ? 'var(--color-success)' : 'var(--color-border)'}`,
                                }}
                              >
                                {getOptionLabel(idx)}. {option} {isCorrect ? '（正确）' : ''}
                              </div>
                            );
                          })}
                        </div>

                        {item.question.explanation && (
                          <p className="mt-3 text-sm" style={{ color: 'var(--color-secondary)' }}>
                            解析：{item.question.explanation}
                          </p>
                        )}

                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => openMoveModal(item)}
                            className="px-3 py-1 rounded text-sm"
                            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
                          >
                            移动分类
                          </button>
                          <button
                            onClick={() => handleDelete(item.questionId)}
                            className="px-3 py-1 rounded text-sm"
                            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}
                          >
                            取消收藏
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {favorites.length === 0 && viewMode === 'stats' && (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">⭐</p>
            <p style={{ color: 'var(--color-text)' }}>暂无收藏题目</p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-secondary)' }}>
              做题时可将高价值题目加入收藏，便于回看
            </p>
            <Link
              to="/quiz-import"
              className="inline-block mt-4 px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              去做题
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
