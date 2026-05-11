/**
 * 填空题导入页面
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FillBlankItem, FillBlankImportRecord } from '../types';
import { 
  getAllFillBlankItems, 
  saveFillBlankItem, 
  deleteFillBlankItem
} from '../services/storage/indexedDB';
import { 
  createImportRecord,
  getAllImportRecords,
  deleteImportRecord
} from '../services/learning/fillBlankImportRecord';

type ImportMode = 'manual' | 'batch';

export default function FillBlankImportPage() {
  const navigate = useNavigate();
  const [importMode, setImportMode] = useState<ImportMode>('manual');
  const [fillBlankItems, setFillBlankItems] = useState<FillBlankItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importRecords, setImportRecords] = useState<FillBlankImportRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [showRecords, setShowRecords] = useState(false);
  
  // 手动输入表单
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [category, setCategory] = useState('general');
  const [tags, setTags] = useState('');
  const [hints, setHints] = useState('');
  
  // 批量导入
  const [batchText, setBatchText] = useState('');
  const [batchCategory, setBatchCategory] = useState('general');
  const [batchDifficulty, setBatchDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  useEffect(() => {
    loadFillBlankItems();
    loadImportRecords();
  }, []);

  async function loadImportRecords() {
    try {
      const records = await getAllImportRecords();
      setImportRecords(records);
    } catch (err) {
      console.error('加载导入记录失败:', err);
    }
  }

  async function loadFillBlankItems() {
    try {
      const items = await getAllFillBlankItems();
      setFillBlankItems(items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('加载填空题失败:', error);
    }
  }

  function normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\u3000]/g, ' ')
      .trim();
  }

  function parseBatchText(text: string): Array<{question: string, answer: string}> {
    const lines = text.split('\n').filter(line => line.trim());
    const items: Array<{question: string, answer: string}> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 支持多种格式：
      // 1. 问题___答案
      // 2. 问题|答案
      // 3. 问题\t答案
      // 4. 数据库查询格式：42. 该条数据库语句  SELECT * FROM students WHERE age BETWEEN 15 AND 20; 的作用是（查找学生集合中年龄在15~20之间的人 ） 答案：查找学生集合中年龄在15~20之间的人
      // 5. RESTful API 格式：46. 在 RESTful API 中，POST 请求通常用于（创建 ）数据。 答案：创建 （答案在第二行）
      // 6. 括号内答案格式：46. 在 RESTful API 中，POST 请求通常用于（创建 ）数据。
      const match1 = line.match(/^(.+?)___(.+?)$/);
      const match2 = line.match(/^(.+?)\|(.+?)$/);
      const match3 = line.match(/^(.+?)\t(.+?)$/);
      const match4 = line.match(/^\d+\.\s*(.+?)答案[：:](.+?)$/);
      const bracketMatch = line.match(/^\d+\.\s*(.*?)[（(]\s*(.+?)\s*[）)](.*)$/);
      
      if (match1) {
        items.push({ question: match1[1].trim(), answer: match1[2].trim() });
      } else if (match2) {
        items.push({ question: match2[1].trim(), answer: match2[2].trim() });
      } else if (match3) {
        items.push({ question: match3[1].trim(), answer: match3[2].trim() });
      } else if (match4) {
        // 数据库查询格式：编号. 题目答案
        items.push({ question: match4[1].trim(), answer: match4[2].trim() });
      } else {
        // 6. 括号内答案格式：从括号中提取答案；题干把括号内容替换为 ___
        if (bracketMatch) {
          const answer = bracketMatch[2].trim();
          const question = `${bracketMatch[1].trim()}___${bracketMatch[3].trim()}`.trim();
          if (answer && question) {
            items.push({ question, answer });
            continue;
          }
        }

        // 5. 答案在下一行：当前行做题目，下一行以“答案：”开头
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const answerMatch = nextLine.match(/^答案[：:](.+?)$/);
          if (answerMatch) {
            const question = line.trim();
            const answer = answerMatch[1].trim();
            if (question && answer) {
              items.push({ question, answer });
              i++; // 跳过下一行
            }
          }
        }
      }
    }
    
    return items;
  }

  async function handleAddSingle() {
    if (!question.trim() || !answer.trim()) {
      alert('请填写题目和答案');
      return;
    }

    try {
      const now = new Date();
      const normalizedQuestion = normalizeText(question);
      const normalizedCategory = normalizeText(category || 'general') || 'general';
      const existing = fillBlankItems.find(
        (it) => normalizeText(it.category || 'general') === normalizedCategory && normalizeText(it.question) === normalizedQuestion
      );

      const itemToSave: FillBlankItem = existing
        ? {
            ...existing,
            answer: normalizeText(answer),
            hints: hints.trim() ? hints.split(',').map(h => h.trim()).filter(Boolean) : undefined,
            difficulty,
            category: normalizedCategory,
            tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            updatedAt: now,
          }
        : {
            id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            question: normalizedQuestion,
            answer: normalizeText(answer),
            hints: hints.trim() ? hints.split(',').map(h => h.trim()).filter(Boolean) : undefined,
            difficulty,
            category: normalizedCategory,
            tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            createdAt: now,
            updatedAt: now,
          };

      await saveFillBlankItem(itemToSave);
      setQuestion('');
      setAnswer('');
      setHints('');
      setTags('');
      await loadFillBlankItems();
      await loadImportRecords();
      
      // 创建导入记录
      const recordName = `手动添加 ${new Date().toLocaleString('zh-CN')}`;
      await createImportRecord(recordName, [itemToSave], `手动添加 1 道填空题`);
      
      alert(existing ? '已合并并更新该题！' : '添加成功！');
    } catch (error) {
      console.error('添加失败:', error);
      alert('添加失败，请重试');
    }
  }

  async function handleBatchImport() {
    const items = parseBatchText(batchText);
    
    if (items.length === 0) {
      alert('未找到有效的填空题，请检查格式');
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const normalizedCategory = normalizeText(batchCategory || 'general') || 'general';

      const existingMap = new Map<string, FillBlankItem>();
      fillBlankItems.forEach((it) => {
        const key = `${normalizeText(it.category || 'general')}::${normalizeText(it.question)}`;
        existingMap.set(key, it);
      });

      let createdCount = 0;
      let mergedCount = 0;

      for (const item of items) {
        const normalizedQuestion = normalizeText(item.question);
        const normalizedAnswer = normalizeText(item.answer);
        if (!normalizedQuestion || !normalizedAnswer) continue;

        const key = `${normalizedCategory}::${normalizedQuestion}`;
        const existing = existingMap.get(key);

        const fillBlankItem: FillBlankItem = existing
          ? {
              ...existing,
              answer: normalizedAnswer,
              difficulty: batchDifficulty,
              category: normalizedCategory,
              updatedAt: new Date(),
            }
          : {
              id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
              question: normalizedQuestion,
              answer: normalizedAnswer,
              difficulty: batchDifficulty,
              category: normalizedCategory,
              tags: [],
              createdAt: now,
              updatedAt: now,
            };

        await saveFillBlankItem(fillBlankItem);
        existingMap.set(key, fillBlankItem);
        if (existing) mergedCount += 1;
        else createdCount += 1;
      }
      
      setBatchText('');
      await loadFillBlankItems();
      await loadImportRecords();
      
      // 创建导入记录 - 需要传递完整的 FillBlankItem 数组
      const savedItems: FillBlankItem[] = [];
      for (const item of items) {
        const normalizedQuestion = normalizeText(item.question);
        const normalizedAnswer = normalizeText(item.answer);
        if (!normalizedQuestion || !normalizedAnswer) continue;

        const key = `${normalizedCategory}::${normalizedQuestion}`;
        const existing = existingMap.get(key);

        const fillBlankItem: FillBlankItem = existing
          ? {
              ...existing,
              answer: normalizedAnswer,
              difficulty: batchDifficulty,
              category: normalizedCategory,
              updatedAt: new Date(),
            }
          : {
              id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
              question: normalizedQuestion,
              answer: normalizedAnswer,
              difficulty: batchDifficulty,
              category: normalizedCategory,
              tags: [],
              createdAt: now,
              updatedAt: now,
            };
        
        savedItems.push(fillBlankItem);
      }
      
      const recordName = `批量导入 ${new Date().toLocaleString('zh-CN')}`;
      await createImportRecord(recordName, savedItems, `导入 ${savedItems.length} 道填空题`);
      
      alert(`成功导入 ${createdCount} 道填空题，合并更新 ${mergedCount} 道！`);
    } catch (error) {
      console.error('批量导入失败:', error);
      alert('导入失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这道填空题吗？')) return;
    
    try {
      await deleteFillBlankItem(id);
      await loadFillBlankItems();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  }

  async function handlePracticeAll() {
    if (fillBlankItems.length === 0) {
      alert('暂无填空题可练习');
      return;
    }
    
    sessionStorage.setItem('fillBlankPractice', JSON.stringify(fillBlankItems));
    navigate('/fill-blank-practice');
  }

  async function handleSpellPracticeAll() {
    if (fillBlankItems.length === 0) {
      alert('暂无填空题可练习');
      return;
    }

    sessionStorage.setItem('fillBlankPractice', JSON.stringify(fillBlankItems));
    navigate('/fill-blank-spell-practice');
  }

  async function handlePracticeSingle(item: FillBlankItem, mode: 'practice' | 'spell') {
    sessionStorage.setItem('fillBlankPractice', JSON.stringify([item]));
    navigate(mode === 'spell' ? '/fill-blank-spell-practice' : '/fill-blank-practice');
  }

  function getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
      case 'easy': return 'var(--color-success)';
      case 'medium': return 'var(--color-warning)';
      case 'hard': return 'var(--color-error)';
      default: return 'var(--color-secondary)';
    }
  }

  function getDifficultyLabel(difficulty: string): string {
    switch (difficulty) {
      case 'easy': return '简单';
      case 'medium': return '中等';
      case 'hard': return '困难';
      default: return '未知';
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <header className="shadow" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Link to="/" className="mr-4 p-2 rounded-full hover:opacity-80">
              <svg className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>📝 填空题管理</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* 导入模式切换 */}
        <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: 'var(--color-card)' }}>
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setImportMode('manual')}
              className={`px-4 py-2 rounded-lg font-medium ${
                importMode === 'manual' ? 'text-white' : ''
              }`}
              style={{
                backgroundColor: importMode === 'manual' ? 'var(--color-primary)' : 'var(--color-bg)',
                color: importMode === 'manual' ? 'white' : 'var(--color-text)'
              }}
            >
              手动添加
            </button>
            <button
              onClick={() => setImportMode('batch')}
              className={`px-4 py-2 rounded-lg font-medium ${
                importMode === 'batch' ? 'text-white' : ''
              }`}
              style={{
                backgroundColor: importMode === 'batch' ? 'var(--color-primary)' : 'var(--color-bg)',
                color: importMode === 'batch' ? 'white' : 'var(--color-text)'
              }}
            >
              批量导入
            </button>
            <button
              onClick={() => navigate('/fill-blank-favorites')}
              className="px-4 py-2 rounded-lg font-medium"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
            >
              收藏夹
            </button>
            <button
              onClick={() => navigate('/fill-blank-wrong-answers')}
              className="px-4 py-2 rounded-lg font-medium"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}
            >
              错题本
            </button>
            <button
              onClick={handleSpellPracticeAll}
              disabled={fillBlankItems.length === 0}
              className="px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-warning)' }}
            >
              拼写练习
            </button>
            <button
              onClick={handlePracticeAll}
              disabled={fillBlankItems.length === 0}
              className="px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-success)' }}
            >
              开始练习 ({fillBlankItems.length})
            </button>
          </div>

          {importMode === 'manual' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>题目（包含___表示填空位置）</label>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                  placeholder="例如：马克思主义的基本原理是___"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>答案</label>
                <input
                  type="text"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                  placeholder="例如：辩证唯物主义"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>难度</label>
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                  >
                    <option value="easy">简单</option>
                    <option value="medium">中等</option>
                    <option value="hard">困难</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>分类</label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                    placeholder="例如：马克思主义原理"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>提示（可选，用逗号分隔）</label>
                <input
                  type="text"
                  value={hints}
                  onChange={e => setHints(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                  placeholder="例如：答案长度3个字,首字是辩"
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>标签（可选，用逗号分隔）</label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                  placeholder="例如：马克思主义,哲学,基础"
                />
              </div>

              <button
                onClick={handleAddSingle}
                disabled={!question.trim() || !answer.trim()}
                className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                添加填空题
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>批量导入填空题</label>
                <textarea
                  value={batchText}
                  onChange={e => setBatchText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg font-mono text-sm"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                  placeholder="每行一道题，支持以下格式：&#10;1. 问题___答案&#10;2. 问题|答案&#10;3. 问题\t答案&#10;4. 编号. 问题答案（支持中文冒号和英文冒号）&#10;&#10;示例：&#10;1. 马克思主义的基本原理是___|辩证唯物主义&#10;2. ___是马克思主义的核心|实践&#10;3. 42. 该条数据库语句  SELECT * FROM students WHERE age BETWEEN 15 AND 20; 的作用是（查找学生集合中年龄在15~20之间的人）答案：查找学生集合中年龄在15~20之间的人&#10;4. 在 Express 中使用（ app.use）方法可将路由处理程序挂载到特定的路径前缀上。答案：app.use"
                  rows={10}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>默认难度</label>
                  <select
                    value={batchDifficulty}
                    onChange={e => setBatchDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                  >
                    <option value="easy">简单</option>
                    <option value="medium">中等</option>
                    <option value="hard">困难</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-secondary)' }}>默认分类</label>
                  <input
                    type="text"
                    value={batchCategory}
                    onChange={e => setBatchCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                    placeholder="例如：马克思主义原理"
                  />
                </div>
              </div>

              <button
                onClick={handleBatchImport}
                disabled={!batchText.trim() || loading}
                className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {loading ? '导入中...' : '批量导入'}
              </button>
            </div>
          )}
        </div>

        {/* 填空题列表 */}
        <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--color-card)' }}>
          <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>
            已导入填空题 ({fillBlankItems.length})
          </h2>
          
          {fillBlankItems.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--color-secondary)' }}>
              暂无填空题，请先添加或导入题目
            </div>
          ) : (
            <div className="space-y-3">
              {fillBlankItems.map(item => (
                <div key={item.id} className="rounded-lg" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>{item.question}</p>
                        <p className="text-sm mb-2" style={{ color: 'var(--color-secondary)' }}>
                          答案：<span className="font-medium" style={{ color: 'var(--color-text)' }}>{item.answer}</span>
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span 
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{ backgroundColor: getDifficultyColor(item.difficulty), color: 'white' }}
                          >
                            {getDifficultyLabel(item.difficulty)}
                          </span>
                          {item.category && (
                            <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-secondary)' }}>
                              {item.category}
                            </span>
                          )}
                          {item.tags.length > 0 && (
                            <div className="flex gap-1">
                              {item.tags.map(tag => (
                                <span key={tag} className="px-2 py-1 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-secondary)' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handlePracticeSingle(item, 'practice')} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-success)' }}>
                          练习
                        </button>
                        <button onClick={() => handlePracticeSingle(item, 'spell')} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-warning)' }}>
                          拼写练习
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}>
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 导入记录管理 */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--color-card)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium" style={{ color: 'var(--color-text)' }}>导入记录</h2>
            <button
              onClick={() => setShowRecords(!showRecords)}
              className="px-4 py-2 rounded-lg font-medium"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
            >
              {showRecords ? '隐藏记录' : '显示记录'}
            </button>
          </div>

          {showRecords && (
            <>
              {importRecords.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--color-secondary)' }}>
                  暂无导入记录
                </div>
              ) : (
                <div className="space-y-3">
                  {importRecords.map(record => (
                    <div key={record.id} className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <input
                              type="checkbox"
                              checked={selectedRecords.includes(record.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecords([...selectedRecords, record.id]);
                                } else {
                                  setSelectedRecords(selectedRecords.filter(id => id !== record.id));
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>{record.name}</h3>
                          </div>
                          {record.description && (
                            <p className="text-sm mb-2" style={{ color: 'var(--color-secondary)' }}>{record.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-secondary)' }}>
                            <span>{record.itemCount} 道题</span>
                            {record.category && <span>分类：{record.category}</span>}
                            <span>创建时间：{new Date(record.createdAt).toLocaleString('zh-CN')}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              // 根据记录筛选题目并练习
                              const recordItems = fillBlankItems.filter(item => 
                                item.createdAt >= new Date(record.createdAt) && 
                                item.createdAt <= new Date(record.updatedAt)
                              );
                              if (recordItems.length > 0) {
                                sessionStorage.setItem('fillBlankPractice', JSON.stringify(recordItems));
                                navigate('/fill-blank-practice');
                              } else {
                                alert('该记录中没有找到对应的题目');
                              }
                            }}
                            className="px-3 py-1 rounded text-sm"
                            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-success)' }}
                          >
                            练习
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('确定要删除这条导入记录吗？')) {
                                deleteImportRecord(record.id);
                                setImportRecords(importRecords.filter(r => r.id !== record.id));
                              }
                            }}
                            className="px-3 py-1 rounded text-sm"
                            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-error)' }}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedRecords.length > 0 && (
                <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--color-text)' }}>
                      已选择 {selectedRecords.length} 条记录
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // 合并选中记录的题目
                          const allRecordItems: FillBlankItem[] = [];
                          selectedRecords.forEach(recordId => {
                            const record = importRecords.find(r => r.id === recordId);
                            if (record) {
                              const recordItems = fillBlankItems.filter(item => 
                                item.createdAt >= new Date(record.createdAt) && 
                                item.createdAt <= new Date(record.updatedAt)
                              );
                              allRecordItems.push(...recordItems);
                            }
                          });
                          
                          if (allRecordItems.length > 0) {
                            sessionStorage.setItem('fillBlankPractice', JSON.stringify(allRecordItems));
                            navigate('/fill-blank-practice');
                          } else {
                            alert('选中的记录中没有找到对应的题目');
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white"
                        style={{ backgroundColor: 'var(--color-success)' }}
                      >
                        练习选中记录
                      </button>
                      <button
                        onClick={() => setSelectedRecords([])}
                        className="px-4 py-2 rounded-lg font-medium"
                        style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                      >
                        清空选择
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
