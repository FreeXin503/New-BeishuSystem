/**
 * 语料资产中心
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContentStore } from '../stores/useContentStore';
import { parseContent, parseContentByChapters } from '../services/ai/parser';
import { AIServiceError } from '../services/ai/deepseek';
import { AppLayout } from '../components/layout';
import { useToast } from '../components/ui';
import type { ParsedContent } from '../types';

export default function ContentPage() {
  const navigate = useNavigate();
  const { contents, addContent, studySessions } = useContentStore();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parseMode, setParseMode] = useState<'full' | 'chapter'>('full');
  const [activeTab, setActiveTab] = useState<'text' | 'quiz' | 'fillblank'>('text');
  const [dragActive, setDragActive] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const toast = useToast();

  // Helper to handle text files (.txt, .md)
  const processFile = (file: File) => {
    if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileContent = event.target?.result as string;
        setText(fileContent);
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
        toast.success(`成功读取文件：${file.name}`);
        setShowImportForm(true); // Open import form when file loaded
      };
      reader.readAsText(file);
    } else {
      toast.error('目前仅支持 .txt 和 .md 格式的纯文本文件');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!text.trim()) {
      setError('请输入政治文本内容');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const parsed = parseMode === 'chapter' 
        ? await parseContentByChapters(text)
        : await parseContent(text);
      
      const content: ParsedContent = {
        id: `content-${Date.now()}`,
        title: title.trim() || parsed.title || '未命名内容',
        chapters: parsed.chapters,
        keywords: parsed.keywords,
        concepts: parsed.concepts,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addContent(content);
      
      const { saveContent } = await import('../services/storage/indexedDB');
      await saveContent(content);

      toast.success('语料导入并成功解析！');
      setShowImportForm(false);
      setText('');
      setTitle('');
      
      navigate(`/learning/${content.id}`);
    } catch (err) {
      if (err instanceof AIServiceError && !err.retryable) {
        setError('AI 功能暂不可用，请在设置中配置 DeepSeek API Key 后使用');
      } else {
        setError(err instanceof Error ? err.message : '解析失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  }

  // Calculate stats for a given content id
  const getContentStats = (content: ParsedContent) => {
    const matchedSessions = studySessions?.filter(s => s.contentId === content.id) || [];
    const entityCount = content.keywords?.length || 0;
    const practiceCount = matchedSessions.length;
    return `${entityCount} 组实体 / ${practiceCount} 次打卡`;
  };

  return (
    <AppLayout title="语料资产中心" showBack onBack={() => navigate('/')}>
      <div className="page-fade-in p-8 md:p-12 max-w-6xl mx-auto space-y-10">
        
        {/* Flat high-fidelity Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200/60 pb-8 gap-4">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">语料资产中心</h2>
            <p className="text-slate-500 mt-2 text-sm">全格式资源处理、自适应长文本划词与防腐转换</p>
          </div>
          <button
            onClick={() => setShowImportForm(!showImportForm)}
            className="bg-brand-primary px-6 py-3 rounded-2xl text-white font-bold text-sm shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98] transition-all duration-300"
          >
            {showImportForm ? '收起导入面板' : '导入语料 / Quiz'}
          </button>
        </header>

        {/* Dynamic Import Sandbox Drawer / Form */}
        {showImportForm && (
          <div className="bg-white rounded-master p-8 border border-workspace-border shadow-panel-flat space-y-8 page-fade-in">
            {/* Functional Pill Tabs */}
            <div className="flex border-b border-slate-200/60 pb-3">
              <nav className="flex space-x-6">
                {[
                  { id: 'text', label: '📖 文本内容', desc: '导入政治文本，由 AI 自动解析' },
                  { id: 'quiz', label: '🎯 选择题', desc: '批量导入客观选择题' },
                  { id: 'fillblank', label: '✏️ 填空题', desc: '导入或管理段落挖空' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'border-brand-primary text-brand-primary'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* TAB: Text Area with Drag & Drop */}
            {activeTab === 'text' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* File Upload Area */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-master p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative min-h-[220px] ${
                      dragActive
                        ? 'border-brand-primary bg-indigo-50/20'
                        : 'border-slate-200 bg-slate-50/30 hover:border-brand-primary hover:bg-slate-50/50'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".txt,.md"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      title="拖拽或点击上传本地文件"
                    />
                    <div className="text-4xl mb-3">📤</div>
                    <h4 className="text-sm font-bold text-slate-700">拖拽文本或 Markdown 文件至此</h4>
                    <p className="text-xs text-slate-400 mt-2">支持 .txt 和 .md 纯文本文件</p>
                    <button
                      type="button"
                      className="mt-4 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-brand-primary shadow-sm hover:border-brand-primary hover:bg-indigo-50/10 transition-all"
                    >
                      浏览本地文件
                    </button>
                  </div>

                  {/* Title and Settings Panel */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div>
                      <label htmlFor="title" className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                        语料标题 (可选)
                      </label>
                      <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="输入内容标题，留空则由 AI 自动推断"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/25 bg-slate-50/50 focus:bg-white transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                        AI 解析模式
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          onClick={() => setParseMode('full')}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 text-left ${
                            parseMode === 'full'
                              ? 'border-brand-primary bg-indigo-50/15'
                              : 'border-slate-100 bg-slate-50/30 hover:border-slate-200'
                          }`}
                        >
                          <h5 className="font-bold text-xs text-slate-800">整体分析</h5>
                          <p className="text-[10px] text-slate-400 mt-1">提取全局结构，适合较短的独立段落或演讲</p>
                        </div>
                        <div
                          onClick={() => setParseMode('chapter')}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 text-left ${
                            parseMode === 'chapter'
                              ? 'border-brand-primary bg-indigo-50/15'
                              : 'border-slate-100 bg-slate-50/30 hover:border-slate-200'
                          }`}
                        >
                          <h5 className="font-bold text-xs text-slate-800">按章节分析</h5>
                          <p className="text-[10px] text-slate-400 mt-1">自动拆分多层级章节，提取颗粒度更细的背诵链</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Raw Text Input */}
                <div className="space-y-2">
                  <label htmlFor="content" className="block text-xs font-black text-slate-400 uppercase tracking-wider">
                    政治文本内容输入
                  </label>
                  <textarea
                    id="content"
                    rows={8}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="在此直接粘贴或输入政治学习内容、大纲、法条等，AI 将自动分析句法语义并生成学习背诵实体..."
                    className="w-full p-4 rounded-xl border border-slate-200 text-sm leading-relaxed focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/25 bg-slate-50/30 focus:bg-white transition-all"
                  />
                </div>

                {/* Error Panel */}
                {error && (
                  <div className="p-4 rounded-2xl bg-feedback-errorLight border border-feedback-error/20 flex gap-3 text-feedback-error text-xs font-semibold">
                    <span>⚠️</span>
                    <p>{error}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setText('');
                      setTitle('');
                      setShowImportForm(false);
                    }}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-brand-primary px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-lg shadow-indigo-600/10 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95 transition-all"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        AI 正在执行格式清洗与划词解析...
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        启动 AI 深度解析
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB: Quiz Area */}
            {activeTab === 'quiz' && (
              <div className="text-center py-8 space-y-6">
                <div className="h-16 w-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-3xl mx-auto shadow-sm">
                  🎯
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-lg font-bold text-slate-800">导入客观选择题</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    系统内置强健的选择题解析契约。支持自动匹配标准答案、纠错反馈，生成精美的离线自测卡包。
                  </p>
                </div>
                <button
                  onClick={() => navigate('/quiz-import')}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold text-sm shadow-md hover:from-teal-600 hover:to-emerald-700 active:scale-95 transition-all"
                >
                  前往选择题导入面板 →
                </button>
              </div>
            )}

            {/* TAB: Fillblank Area */}
            {activeTab === 'fillblank' && (
              <div className="text-center py-8 space-y-6">
                <div className="h-16 w-16 rounded-full bg-indigo-50 text-brand-primary flex items-center justify-center text-3xl mx-auto shadow-sm">
                  ✏️
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-lg font-bold text-slate-800">管理填空题</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    提供多维度挖空（行内 Popover 候选与逐字盲打输入）设置。帮助从段落框架到政治实体细节的全面精细记忆。
                  </p>
                </div>
                <button
                  onClick={() => navigate('/fill-blank-import')}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold text-sm shadow-md hover:from-indigo-600 hover:to-indigo-700 active:scale-95 transition-all"
                >
                  前往填空题管理中心 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Existing Assets Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              存量语料资源列表 ({contents.length})
            </h3>
            <span className="text-[10px] font-bold text-slate-400">已对齐 IndexedDB 脱敏数据层</span>
          </div>

          {contents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {contents.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-master p-8 border border-workspace-border shadow-panel-flat hover:shadow-md hover:border-indigo-200 transition-all duration-300 group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <span className="px-3 py-1 bg-indigo-50 text-brand-primary text-[10px] font-black rounded-lg uppercase tracking-wider">
                        {item.chapters?.length > 1 ? 'Multi-Chapter' : 'Single Text'} 语料
                      </span>
                      <span className="text-[10px] text-slate-400">
                        导入时间: {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-brand-primary transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      包含 {item.chapters?.length || 0} 个章节结构，{item.concepts?.length || 0} 组核心学术概念及 {item.keywords?.length || 0} 个背诵实体。
                    </p>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-500">
                      {getContentStats(item)}
                    </span>
                    <button
                      onClick={() => navigate(`/learning/${item.id}`)}
                      className="text-brand-primary font-black text-sm flex items-center gap-1 group-hover:translate-x-1 transition-all duration-300"
                    >
                      启动演练
                      <span>→</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-slate-100 rounded-master p-16 text-center bg-slate-50/50 space-y-4">
              <div className="text-5xl">📦</div>
              <h4 className="font-bold text-slate-700">暂无任何导入语料</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                点击上方“导入语料 / Quiz”按钮，粘贴一段政治文本或上传文件，让 AI 为您自动转化并构建高水准的背诵资源。
              </p>
            </div>
          )}
        </div>

        {/* Detailed User Guide Panel */}
        <div className="rounded-master p-8 border border-workspace-border bg-white shadow-panel-flat space-y-6">
          <h3 className="text-lg font-bold text-slate-800">
            💡 智能语料转换引擎说明书
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-brand-primary uppercase">1. 实体降解与防腐清洗</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                所有导入的文本均由防腐转换工厂 (Transformer) 执行多层过滤，消除外部标签和杂乱标记，保证 IndexedDB 储存的数据实体完全纯净。
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-brand-primary uppercase">2. 记忆链自适应分割</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                对于长文本，AI 将依据树形章节节点分割语义单元。每个节点都会分配专有权重，以支撑多态模式 (选择、拼写、填空) 的柔性注入。
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-brand-primary uppercase">3. 海马体时钟对齐</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                每次打卡与复习都会记录入离线预写发件箱日志 (WAOL)，并由底层 SM-2 算法精算其遗忘向量，自动生成后续最优的间隔复习周期。
              </p>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

