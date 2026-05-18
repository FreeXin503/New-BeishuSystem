import React, { useState, useEffect } from 'react';
import type { FavoriteCategory } from '../../types';
import { getFavoriteCategories, createFavoriteCategory, DEFAULT_FAVORITE_CATEGORY } from '../../services/learning/favorite';
import Modal from '../ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (categoryId: string) => void;
  title?: string;
  initialCategoryId?: string;
}

const FavoriteCategoryPicker: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  title = '选择收藏夹',
  initialCategoryId = 'default'
}) => {
  const [categories, setCategories] = useState<FavoriteCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const cats = await getFavoriteCategories();
      // Ensure default is there if not returned
      if (!cats.find(c => c.id === 'default')) {
        setCategories([DEFAULT_FAVORITE_CATEGORY, ...cats]);
      } else {
        setCategories(cats);
      }
    } catch (err) {
      console.error('加载分类失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newCatName.trim()) return;
    setCreating(true);
    try {
      const newCat = await createFavoriteCategory(newCatName.trim());
      setCategories(prev => [...prev, newCat]);
      setNewCatName('');
      setShowCreate(false);
      onSelect(newCat.id);
    } catch (err) {
      console.error('创建分类失败:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" style={{ borderColor: 'var(--color-primary)' }}></div>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all border ${
                  initialCategoryId === cat.id 
                    ? 'border-primary bg-primary bg-opacity-5' 
                    : 'border-transparent hover:bg-gray-50'
                }`}
                style={{ 
                  borderColor: initialCategoryId === cat.id ? 'var(--color-primary)' : 'transparent',
                  backgroundColor: initialCategoryId === cat.id ? 'rgba(59, 130, 246, 0.05)' : ''
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>{cat.name}</span>
                  {cat.id === 'default' && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">默认</span>}
                </div>
                {cat.description && <p className="text-xs mt-1" style={{ color: 'var(--color-secondary)' }}>{cat.description}</p>}
              </button>
            ))}
          </div>
        )}

        {showCreate ? (
          <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--color-border)' }}>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="输入新收藏夹名称..."
              className="w-full px-4 py-2 rounded-lg border focus:ring-2 outline-none transition-all"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newCatName.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {creating ? '创建中...' : '确认创建'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 hover:bg-gray-50 transition-all text-sm font-medium"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-secondary)' }}
          >
            <span className="text-lg">+</span> 新建收藏夹
          </button>
        )}
      </div>
    </Modal>
  );
};

export default FavoriteCategoryPicker;
