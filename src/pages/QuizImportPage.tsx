/**
 * 选择题/判断题导入页面
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { validateParsedQuestions, autoParseQuestions, validateParsedJudgments } from '../services/learning/quiz';
import { createQuizArchive, getArchives, updateArchive, removeArchive } from '../services/learning/quizArchive';
import { DEFAULT_QUIZ_CATEGORIES, getCategoryLabel } from '../services/learning/wrongAnswer';
import { getAllCustomCategories, saveCustomCategory, deleteCustomCategory } from '../services/storage/indexedDB';
import type { Question, QuizArchive } from '../types';

interface CategoryOption {
  value: string;
  label: string;
  isCustom?: boolean;
}

export default function QuizImportPage() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [archives, setArchives] = useState<QuizArchive[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const [questionType, setQuestionType] = useState<'choice' | 'judgment' | 'mixed'>('choice');
  
  // 分类相关
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  
  // 保存题库表单
  const [archiveTitle, setArchiveTitle] = useState('');
  const [archiveCategory, setArchiveCategory] = useState('other');
  const [archiveDescription, setArchiveDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedArchiveId, setSavedArchiveId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // 编辑题库
  const [editingArchive, setEditingArchive] = useState<QuizArchive | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    loadArchives();
    loadCategories();
  }, []);

  async function loadArchives() {
    const list = await getArchives();
    setArchives(list);
  }

  async function loadCategories() {
    const customCats = await getAllCustomCategories();
    const allCategories: CategoryOption[] = [
      ...DEFAULT_QUIZ_CATEGORIES,
      ...customCats.map(c => ({ value: c.value, label: c.label, isCustom: true }))
    ];
    setCategories(allCategories);
  }

  const handleAddCategory = async () => {
    if (!newCategoryLabel.trim()) return;
    
    const value = `custom-${Date.now()}`;
    await saveCustomCategory({
      value,
      label: newCategoryLabel.trim(),
      createdAt: new Date(),
    });
    
    await loadCategories();
    setArchiveCategory(value);
    setNewCategoryLabel('');
    setShowAddCategory(false);
  };

  const handleDeleteCategory = async (value: string) => {
    if (!confirm('确定要删除这个分类吗？')) return;
    await deleteCustomCategory(value);
    await loadCategories();
    if (archiveCategory === value) {
      setArchiveCategory('other');
    }
  };

  const handleParse = () => {
    if (!text.trim()) return;
    
    setIsParsing(true);
    setParseErrors([]);
    setSavedArchiveId(null);
    setSaveSuccess(false);
    
    try {
      // 自动检测题目类型并解析
      const result = autoParseQuestions(text);
      setQuestionType(result.type);
      
      // 根据题目类型验证
      let valid: Question[] = [];
      let invalid: { question: Question; errors: string[] }[] = [];
      
      if (result.type === 'judgment') {
        const validation = validateParsedJudgments(result.questions);
        valid = validation.valid;
        invalid = validation.invalid;
      } else {
        const validation = validateParsedQuestions(result.questions);
        valid = validation.valid;
        invalid = validation.invalid;
      }
      
      setParsedQuestions(valid);
      
      const allErrors = [...result.parseErrors];
      if (invalid.length > 0) {
        allErrors.push(...invalid.map((item, i) => 
          `题目 ${i + 1}: ${item.errors.join(', ')}`
        ));
      }
      setParseErrors(allErrors);
      
      if (valid.length > 0) {
        setShowPreview(true);
        const now = new Date();
        const typeLabel = result.type === 'judgment' ? '判断题' : '选择题';
        setArchiveTitle(`${typeLabel} ${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`);
      }
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : '解析失败']);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveOnly = async () => {
    if (!archiveTitle.trim() || parsedQuestions.length === 0) return;
    
    setIsSaving(true);
    try {
      const archive = await createQuizArchive(
        archiveTitle.trim(),
        parsedQuestions,
        archiveCategory,
        archiveDescription.trim() || undefined
      );
      
      setSavedArchiveId(archive.id);
      setSaveSuccess(true);
      await loadArchives();
    } catch (err) {
      console.error('保存题库失败:', err);
      alert(`保存题库失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndPractice = async () => {
    if (!archiveTitle.trim() || parsedQuestions.length === 0) return;
    
    setIsSaving(true);
    try {
      const archive = await createQuizArchive(
        archiveTitle.trim(),
        parsedQuestions,
        archiveCategory,
        archiveDescription.trim() || undefined
      );
      
      sessionStorage.setItem('importedQuiz', JSON.stringify(parsedQuestions));
      sessionStorage.setItem('currentArchiveId', archive.id);
      sessionStorage.setItem('currentCategory', archiveCategory);
      navigate('/quiz-practice');
    } catch (err) {
      console.error('保存题库失败:', err);
      alert(`保存题库失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePracticeWithoutSave = () => {
    sessionStorage.setItem('importedQuiz', JSON.stringify(parsedQuestions));
    sessionStorage.removeItem('currentArchiveId');
    sessionStorage.setItem('currentCategory', archiveCategory);
    navigate('/quiz-practice');
  };

  const handlePracticeSaved = () => {
    if (!savedArchiveId) return;
    sessionStorage.setItem('importedQuiz', JSON.stringify(parsedQuestions));
    sessionStorage.setItem('currentArchiveId', savedArchiveId);
    sessionStorage.setItem('currentCategory', archiveCategory);
    navigate('/quiz-practice');
  };

  const handlePracticeArchive = (archive: QuizArchive) => {
    sessionStorage.setItem('importedQuiz', JSON.stringify(archive.questions));
    sessionStorage.setItem('currentArchiveId', archive.id);
    sessionStorage.setItem('currentCategory', archive.category);
    navigate('/quiz-practice');
  };

  const handleFillBlankPractice = () => {
    if (parsedQuestions.length === 0) return;
    sessionStorage.setItem('importedQuiz', JSON.stringify(parsedQuestions));
    sessionStorage.setItem('currentCategory', archiveCategory);
    navigate('/fill-blank');
  };

  const handleEditArchive = (archive: QuizArchive) => {
    setEditingArchive(archive);
    setEditTitle(archive.title);
    setEditCategory(archive.category);
    setEditDescription(archive.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingArchive || !editTitle.trim()) return;
    
    await updateArchive(editingArchive.id, {
      title: editTitle.trim(),
      category: editCategory,
      description: editDescription.trim() || undefined,
    });
    
    setEditingArchive(null);
    await loadArchives();
  };

  const handleDeleteArchive = async (id: string) => {
    if (!confirm('确定要删除这个题库吗？删除后无法恢复。')) return;
    await removeArchive(id);
    await loadArchives();
  };

  const handleReset = () => {
    setText('');
    setParsedQuestions([]);
    setParseErrors([]);
    setShowPreview(false);
    setArchiveTitle('');
    setArchiveDescription('');
    setSavedArchiveId(null);
    setSaveSuccess(false);
  };

  const exampleText = `1. 中国特色社会主义最本质的特征是什么？
A. 人民当家作主
B. 中国共产党领导
C. 依法治国
D. 改革开放
答案：B

2. "四个全面"战略布局不包括以下哪项？
A. 全面建设社会主义现代化国家
B. 全面深化改革
C. 全面依法治国
D. 全面建设小康社会
答案：D`;

  const judgmentExampleText = `1．当一个进程从等待态变成就绪态，就一定有一个进程从就绪态变成运行态。答案：×
2．在有虚拟存储器的系统中，可以运行比主存容量还大的程序。答案：√
3．打印机是一类典型的字符设备。答案：√`;

  const customCategories = categories.filter(c => c.isCustom);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/" className="mr-4 p-2 rounded-full hover:opacity-80">
                <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>导入选择题</h1>
            </div>
            <div className="flex gap-2">
              <Link to="/favorites" className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-warning)' }}>⭐ 收藏夹</Link>
              <Link to="/wrong-answers" className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}>📕 错题本</Link>
              <button onClick={() => setShowArchives(!showArchives)} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
                📚 题库 ({archives.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* 编辑题库弹窗 */}
        {editingArchive && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="rounded-lg p-6 max-w-md w-full" style={{ backgroundColor: 'var(--color-card)' }}>
              <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>编辑题库</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>题库名称</label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>分类</label>
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>描述</label>
                  <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditingArchive(null)} className="flex-1 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>取消</button>
                <button onClick={handleSaveEdit} disabled={!editTitle.trim()} className="flex-1 py-2 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>保存</button>
              </div>
            </div>
          </div>
        )}

        {/* 题库列表 */}
        {showArchives && (
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-3" style={{ color: 'var(--color-text)' }}>我的题库</h2>
            {archives.length === 0 ? (
              <p className="text-center py-8" style={{ color: 'var(--color-secondary)' }}>暂无题库，导入题目后可保存</p>
            ) : (
              <div className="space-y-3">
                {archives.map(archive => (
                  <div key={archive.id} className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>{archive.title}</h3>
                        <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
                          {getCategoryLabel(archive.category, customCategories)} · {archive.totalCount} 题 · 练习 {archive.practiceCount} 次
                          {archive.bestScore > 0 && ` · 最高 ${archive.bestScore}分`}
                        </p>
                        {archive.description && <p className="text-sm mt-1" style={{ color: 'var(--color-secondary)' }}>{archive.description}</p>}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button onClick={() => handleEditArchive(archive)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>编辑</button>
                        <button onClick={() => handleDeleteArchive(archive.id)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}>删除</button>
                        <button onClick={() => handlePracticeArchive(archive)} className="px-3 py-1 rounded text-sm text-white" style={{ backgroundColor: 'var(--color-primary)' }}>练习</button>
                        <button onClick={() => {
                          sessionStorage.setItem('importedQuiz', JSON.stringify(archive.questions));
                          sessionStorage.setItem('currentCategory', archive.category);
                          navigate('/fill-blank');
                        }} className="px-3 py-1 rounded text-sm text-white" style={{ backgroundColor: 'var(--color-warning)' }}>填空</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!showPreview ? (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>粘贴选择题文本</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={15} placeholder="粘贴选择题文本，支持多种格式..." className="w-full rounded-lg p-4 focus:ring-2 focus:outline-none" style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
            </div>

            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              <h3 className="font-medium mb-3" style={{ color: 'var(--color-text)' }}>📝 支持的格式</h3>
              <div className="text-sm space-y-2" style={{ color: 'var(--color-secondary)' }}>
                <p className="font-medium">选择题：</p>
                <p>• 题号 + 题目 + ABCD选项 + 答案</p>
                <p>• 支持多种答案标记（答案：A / 正确答案：B）</p>
                <p className="font-medium mt-2">判断题：</p>
                <p>• 题号 + 题目 + 答案：√/×</p>
                <p>• 支持多种答案格式（√/×、对/错、T/F）</p>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setText(exampleText)} className="text-sm px-3 py-1 rounded" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>选择题示例</button>
                <button onClick={() => setText(judgmentExampleText)} className="text-sm px-3 py-1 rounded" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>判断题示例</button>
              </div>
            </div>

            {parseErrors.length > 0 && (
              <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-error)' }}>
                <h4 className="font-medium mb-2" style={{ color: 'var(--color-error)' }}>解析问题</h4>
                <ul className="text-sm space-y-1" style={{ color: 'var(--color-error)' }}>
                  {parseErrors.map((err, i) => <li key={i}>• {err}</li>)}
                </ul>
              </div>
            )}

            <button onClick={handleParse} disabled={!text.trim() || isParsing} className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
              {isParsing ? '解析中...' : '解析题目'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-6 p-4 rounded-lg flex items-center justify-between" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-success)' }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-success)' }}>成功解析 {parsedQuestions.length} 道题</p>
                  <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>可以保存到题库或直接开始练习</p>
                </div>
              </div>
              <button onClick={handleReset} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>导入新题</button>
            </div>

            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              <h3 className="font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                📚 保存到题库
                {saveSuccess && <span className="text-sm px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-success)', color: 'white' }}>已保存</span>}
              </h3>
              
              {!saveSuccess ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>题库名称 *</label>
                      <input type="text" value={archiveTitle} onChange={(e) => setArchiveTitle(e.target.value)} placeholder="例如：马原第一章选择题" className="w-full px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>分类</label>
                      <div className="flex gap-2">
                        <select value={archiveCategory} onChange={(e) => setArchiveCategory(e.target.value)} className="flex-1 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                          {categories.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}{cat.isCustom ? ' (自定义)' : ''}</option>
                          ))}
                        </select>
                        <button onClick={() => setShowAddCategory(true)} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>+ 新分类</button>
                      </div>
                      
                      {/* 添加新分类 */}
                      {showAddCategory && (
                        <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                          <input type="text" value={newCategoryLabel} onChange={(e) => setNewCategoryLabel(e.target.value)} placeholder="输入新分类名称" className="w-full px-3 py-2 rounded-lg mb-2" style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
                          <div className="flex gap-2">
                            <button onClick={() => { setShowAddCategory(false); setNewCategoryLabel(''); }} className="flex-1 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)' }}>取消</button>
                            <button onClick={handleAddCategory} disabled={!newCategoryLabel.trim()} className="flex-1 py-1 rounded text-sm text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>添加</button>
                          </div>
                        </div>
                      )}
                      
                      {/* 自定义分类管理 */}
                      {customCategories.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {customCategories.map(cat => (
                            <span key={cat.value} className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
                              {cat.label}
                              <button onClick={() => handleDeleteCategory(cat.value)} className="ml-1 hover:opacity-70" style={{ color: 'var(--color-error)' }}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>描述（可选）</label>
                      <input type="text" value={archiveDescription} onChange={(e) => setArchiveDescription(e.target.value)} placeholder="简单描述..." className="w-full px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={handleSaveOnly} disabled={!archiveTitle.trim() || isSaving} className="flex-1 py-2 rounded-lg font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
                      {isSaving ? '保存中...' : '仅保存到题库'}
                    </button>
                    <button onClick={handleSaveAndPractice} disabled={!archiveTitle.trim() || isSaving} className="flex-1 py-2 rounded-lg font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                      {isSaving ? '保存中...' : '保存并开始练习'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex gap-3">
                  <button onClick={handleFillBlankPractice} className="flex-1 py-2 rounded-lg font-medium text-white" style={{ backgroundColor: 'var(--color-warning)' }}>
                    填空题背诵
                  </button>
                  <button onClick={handlePracticeSaved} className="flex-1 py-2 rounded-lg font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                    开始练习这套题
                  </button>
                  <button onClick={handleReset} className="flex-1 py-2 rounded-lg font-medium" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
                    继续导入新题
                  </button>
                </div>
              )}
            </div>

            {!saveSuccess && (
              <button onClick={handlePracticeWithoutSave} className="w-full py-2 rounded-lg text-sm mb-6" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-secondary)' }}>不保存，直接练习</button>
            )}

            <div>
              <h3 className="font-medium mb-3" style={{ color: 'var(--color-text)' }}>
                题目预览
                {questionType === 'judgment' && <span className="ml-2 text-sm px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>判断题</span>}
                {questionType === 'choice' && <span className="ml-2 text-sm px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>选择题</span>}
              </h3>
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {parsedQuestions.map((q, index) => (
                  <div key={q.id} className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
                    <p className="font-medium mb-3" style={{ color: 'var(--color-text)' }}>{index + 1}. {q.question}</p>
                    {q.type === 'judgment' ? (
                      // 判断题显示
                      <div className="flex gap-4">
                        <div className={`px-4 py-2 rounded text-sm ${q.correctAnswer === '对' ? 'font-medium' : ''}`} style={{ backgroundColor: q.correctAnswer === '对' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg)', color: q.correctAnswer === '对' ? 'var(--color-success)' : 'var(--color-text)', border: q.correctAnswer === '对' ? '1px solid var(--color-success)' : '1px solid var(--color-border)' }}>
                          ✓ 对 {q.correctAnswer === '对' && '✓'}
                        </div>
                        <div className={`px-4 py-2 rounded text-sm ${q.correctAnswer === '错' ? 'font-medium' : ''}`} style={{ backgroundColor: q.correctAnswer === '错' ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg)', color: q.correctAnswer === '错' ? 'var(--color-error)' : 'var(--color-text)', border: q.correctAnswer === '错' ? '1px solid var(--color-error)' : '1px solid var(--color-border)' }}>
                          ✗ 错 {q.correctAnswer === '错' && '✓'}
                        </div>
                      </div>
                    ) : (
                      // 选择题显示
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className={`px-3 py-2 rounded text-sm ${opt === q.correctAnswer ? 'font-medium' : ''}`} style={{ backgroundColor: opt === q.correctAnswer ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg)', color: opt === q.correctAnswer ? 'var(--color-success)' : 'var(--color-text)', border: opt === q.correctAnswer ? '1px solid var(--color-success)' : '1px solid var(--color-border)' }}>
                            {String.fromCharCode(65 + optIndex)}. {opt.length > 20 ? opt.slice(0, 20) + '...' : opt}
                            {opt === q.correctAnswer && ' ✓'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
