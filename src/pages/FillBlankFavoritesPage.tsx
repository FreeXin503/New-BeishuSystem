/**
 * 填空题收藏夹页面
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FavoriteCategory } from '../types';
import type { FillBlankFavorite } from '../types';
import {
  getFavoriteCategories,
  createFavoriteCategory,
  updateFavoriteCategoryInfo,
  removeFavoriteCategory,
  DEFAULT_FAVORITE_CATEGORY,
} from '../services/learning/favorite';
import {
  getAllFillBlankFavorites,
  getFillBlankFavoritesByCategory,
  saveFillBlankFavorite,
  deleteFillBlankFavorite,
} from '../services/storage/indexedDB';

type ViewMode = 'stats' | 'list';

export default function FillBlankFavoritesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('stats');
  const [favorites, setFavorites] = useState<FillBlankFavorite[]>([]);
  const [categories, setCategories] = useState<FavoriteCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 分类管理弹窗
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FavoriteCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');
  const [categoryColor, setCategoryColor] = useState('#3b82f6');

  // 移动分类弹窗
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingFavorite, setMovingFavorite] = useState<FillBlankFavorite | null>(null);

  // 练习入口
  const navigate = useNavigate();
  async function handlePracticeAll(mode: 'practice' | 'spell') {
    if (favorites.length === 0) {
      alert('暂无收藏可练习');
      return;
    }
    const items = favorites.map(f => f.fillBlankItem);
    sessionStorage.setItem('fillBlankPractice', JSON.stringify(items));
    navigate(mode === 'spell' ? '/fill-blank-spell-practice' : '/fill-blank-practice');
  }

  async function handlePracticeSingle(fav: FillBlankFavorite, mode: 'practice' | 'spell') {
    sessionStorage.setItem('fillBlankPractice', JSON.stringify([fav.fillBlankItem]));
    navigate(mode === 'spell' ? '/fill-blank-spell-practice' : '/fill-blank-practice');
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [catsData, allFavs] = await Promise.all([
        getFavoriteCategories(),
        getAllFillBlankFavorites(),
      ]);
      setCategories([DEFAULT_FAVORITE_CATEGORY, ...catsData.filter(c => c.id !== 'default')]);
      setFavorites(
        allFavs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    } catch (err) {
      console.error('加载填空题收藏数据失败:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFilterByCategory(category: string | null) {
    setSelectedCategory(category);
    setLoading(true);
    try {
      if (category) {
        const filtered = await getFillBlankFavoritesByCategory(category);
        setFavorites(
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
      } else {
        const all = await getAllFillBlankFavorites();
        setFavorites(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(favoriteId: string) {
    if (!confirm('确定要取消收藏这道填空题吗？')) return;
    await deleteFillBlankFavorite(favoriteId);
    await loadData();
    if (selectedCategory) {
      await handleFilterByCategory(selectedCategory);
    }
  }

  // 分类管理
  function openAddCategory() {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDesc('');
    setCategoryColor('#3b82f6');
    setShowCategoryModal(true);
  }

  function openEditCategory(cat: FavoriteCategory) {
    if (cat.id === 'default') return;
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDesc(cat.description || '');
    setCategoryColor(cat.color || '#3b82f6');
    setShowCategoryModal(true);
  }

  async function handleSaveCategory() {
    if (!categoryName.trim()) return;

    if (editingCategory) {
      await updateFavoriteCategoryInfo(editingCategory.id, {
        name: categoryName.trim(),
        description: categoryDesc.trim() || undefined,
        color: categoryColor,
      });
    } else {
      await createFavoriteCategory(categoryName.trim(), categoryDesc.trim() || undefined, categoryColor);
    }

    setShowCategoryModal(false);
    await loadData();
  }

  async function handleDeleteCategory(id: string) {
    if (id === 'default') return;
    if (!confirm('删除分类后，该分类下的填空题收藏将移到默认分类。确定删除吗？')) return;

    // 将该分类下的填空题收藏移到默认分类
    const favs = await getFillBlankFavoritesByCategory(id);
    for (const fav of favs) {
      await saveFillBlankFavorite({
        ...fav,
        category: 'default',
      });
    }

    await removeFavoriteCategory(id);
    await loadData();
  }

  // 移动收藏到其他分类
  function openMoveModal(fav: FillBlankFavorite) {
    setMovingFavorite(fav);
    setShowMoveModal(true);
  }

  async function handleMove(newCategory: string) {
    if (!movingFavorite) return;
    await saveFillBlankFavorite({
      ...movingFavorite,
      category: newCategory,
    });
    setShowMoveModal(false);
    setMovingFavorite(null);
    await loadData();
    if (selectedCategory) {
      await handleFilterByCategory(selectedCategory);
    }
  }

  function getCategoryName(categoryId: string): string {
    if (categoryId === 'default') return '默认分类';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || categoryId;
  }

  const totalFavorites = favorites.length;

  // 统计
  const countsByCategory = favorites.reduce<Record<string, number>>((acc, fav) => {
    const c = fav.category || 'default';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* 分类管理弹窗 */}
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
                  onChange={e => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                  placeholder="输入分类名称"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>描述（可选）</label>
                <input
                  type="text"
                  value={categoryDesc}
                  onChange={e => setCategoryDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                  placeholder="输入分类描述"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>颜色</label>
                <div className="flex gap-2">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                    <button
                      key={color}
                      onClick={() => setCategoryColor(color)}
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: color, border: categoryColor === color ? '3px solid var(--color-text)' : 'none' }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCategoryModal(false)} className="flex-1 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>取消</button>
              <button onClick={handleSaveCategory} className="flex-1 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 移动分类弹窗 */}
      {showMoveModal && movingFavorite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg p-6 max-w-sm w-full" style={{ backgroundColor: 'var(--color-card)' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>移动到分类</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleMove(cat.id)}
                  className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-2"
                  style={{
                    backgroundColor: movingFavorite.category === cat.id ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: movingFavorite.category === cat.id ? 'white' : 'var(--color-text)'
                  }}
                >
                  {cat.color && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />}
                  {cat.name}
                </button>
              ))}
            </div>
            <button onClick={() => setShowMoveModal(false)} className="w-full mt-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>取消</button>
          </div>
        </div>
      )}

      <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/fill-blank-import" className="mr-4 p-2 rounded-full hover:opacity-80">
                <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>⭐ 填空题收藏夹</h1>
            </div>
            <button onClick={openAddCategory} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
              + 新建分类
            </button>
            {totalFavorites > 0 && (
              <div className="flex gap-2">
                <button onClick={() => handlePracticeAll('practice')} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-success)' }}>
                  全部练习
                </button>
                <button onClick={() => handlePracticeAll('spell')} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-warning)' }}>
                  拼写练习
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-card)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{totalFavorites}</p>
            <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>总收藏</p>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-card)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{categories.length}</p>
            <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>分类数</p>
          </div>
        </div>

        {viewMode === 'stats' && (
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-3" style={{ color: 'var(--color-text)' }}>分类管理</h2>
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="p-4 rounded-lg flex justify-between items-center" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => { handleFilterByCategory(cat.id); setViewMode('list'); }}>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#6b7280' }} />
                    <div>
                      <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>{cat.name}</h3>
                      <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                        {countsByCategory[cat.id] || 0} 题
                        {cat.description && ` · ${cat.description}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cat.id !== 'default' && (
                      <>
                        <button onClick={() => openEditCategory(cat)} className="p-2 rounded hover:opacity-80">
                          <svg className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 rounded hover:opacity-80">
                          <svg className="w-4 h-4" style={{ color: 'var(--color-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                    <svg className="w-5 h-5" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <button onClick={() => { setViewMode('stats'); setSelectedCategory(null); }} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)' }}>← 返回</button>
              <span className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                {selectedCategory ? getCategoryName(selectedCategory) : '全部'} ({favorites.length} 题)
              </span>
            </div>

            <div className="space-y-4">
              {favorites.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--color-secondary)' }}>暂无收藏填空题</div>
              ) : (
                favorites.map(fav => (
                  <div key={fav.id} className="rounded-lg" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
                    <div className="p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === fav.id ? null : fav.id)}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>{fav.fillBlankItem.question}</p>
                          <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                            {getCategoryName(fav.category)}
                          </p>
                        </div>
                        <svg className={`w-5 h-5 transition-transform ${expandedId === fav.id ? 'rotate-180' : ''}`} style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {expandedId === fav.id && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="pt-4">
                          <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                            答案：<span className="font-medium" style={{ color: 'var(--color-text)' }}>{fav.fillBlankItem.answer}</span>
                          </p>
                          {fav.notes && (
                            <p className="mt-2 text-sm" style={{ color: 'var(--color-secondary)' }}>📝 {fav.notes}</p>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button onClick={() => openMoveModal(fav)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}>移动分类</button>
                          <button onClick={() => handleDelete(fav.id)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}>取消收藏</button>
                          <button onClick={() => handlePracticeSingle(fav, 'practice')} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-success)' }}>练习</button>
                          <button onClick={() => handlePracticeSingle(fav, 'spell')} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-warning)' }}>拼写练习</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {totalFavorites === 0 && viewMode === 'stats' && (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">⭐</p>
            <p style={{ color: 'var(--color-text)' }}>暂无收藏填空题</p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-secondary)' }}>练习时点击“收藏”按钮即可收藏填空题</p>
            <Link to="/fill-blank-import" className="inline-block mt-4 px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>去练习</Link>
          </div>
        )}
      </main>
    </div>
  );
}
