/**
 * 核心演练工作台 - LearningPage.tsx
 * 像素级对齐原型 `id="page-learning"` 的终极全场景交互工作台
 *
 * ⚠️ 纯净 Presenter 组件 — 零副作用、零仓储调用、零直接状态突变
 * 全量状态与业务逻辑由 useLearningFSMController Hook 统一管控
 */

import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout';
import { useLearningFSMController } from '../hooks/useLearningFSMController';

export default function LearningPage() {
  const ctrl = useLearningFSMController();

  if (ctrl.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-workspace-bg">
        {/* Pulsing Skeleton Placeholder */}
        <div className="w-full max-w-4xl p-8 space-y-6 bg-white rounded-master shadow-panel-flat animate-pulse">
          <div className="h-6 bg-slate-200 rounded-md w-1/4"></div>
          <div className="h-32 bg-slate-100 rounded-3xl w-full"></div>
          <div className="space-y-4">
            <div className="h-12 bg-slate-100 rounded-2xl w-full"></div>
            <div className="h-12 bg-slate-100 rounded-2xl w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 视图渲染 1: Dashboard (未选择材料时)
  // ----------------------------------------------------
  if (!ctrl.selectedContent) {
    return (
      <AppLayout title="学习指挥中心" showBack={false}>
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 page-fade-in">
          
          {/* Top Panel Banner */}
          <div className="bg-white rounded-master border border-workspace-border p-8 md:p-12 shadow-panel-flat flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 text-brand-primary font-bold text-xs uppercase tracking-widest mb-2">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-primary animate-ping"></span>
                Learning Command Dashboard
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900">演练控制大厅</h2>
              <p className="text-slate-500 mt-2 text-sm max-w-lg">
                基于有限状态机（FSM）的全自动切题大脑，混合挖空填词、拼写、同义选择多态训练。
              </p>
            </div>
            
            <Link
              to="/content"
              className="px-6 py-3.5 rounded-2xl bg-brand-primary text-white text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 ease-in-out"
            >
              ➕ 导入学术新语料
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left: Material List Grid */}
            <div className="md:col-span-8 space-y-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>📚</span> 待攻坚教材语料库
              </h3>

              {ctrl.contents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {ctrl.contents.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => ctrl.actions.selectMaterial(item.id)}
                      className="bg-white p-6 rounded-[28px] border border-workspace-border hover:border-indigo-200 hover:-translate-y-0.5 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.98] transition-all duration-300 group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-indigo-50 text-brand-primary rounded-lg border border-indigo-100">
                          解析完毕
                        </span>
                        <span className="text-slate-300 text-xs">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-slate-900 group-hover:text-brand-primary transition-colors text-lg line-clamp-1 mb-2">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {item.chapters.length} 章节 · {item.keywords.length} 实体记忆卡片
                      </p>
                      
                      <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">智能 FSM 模式</span>
                        <span className="text-xs font-black text-brand-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          启动演练 →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={ctrl.actions.navigateToContent}
                  className="flex flex-col items-center justify-center p-12 bg-white rounded-master border-2 border-dashed border-slate-200 hover:border-brand-primary hover:bg-indigo-50/5 cursor-pointer transition-all text-center space-y-4"
                >
                  <span className="text-5xl">📥</span>
                  <h4 className="font-bold text-slate-700">导入您的第一份学习材料</h4>
                  <p className="text-xs text-slate-400">AI 将自动执行清洗并划词生成多态背诵实体</p>
                </div>
              )}
            </div>

            {/* Right: Quick Stats & Sidebar */}
            <div className="md:col-span-4 space-y-6">
              <h3 className="text-lg font-bold text-slate-800">🎯 记忆薄弱靶向阻击</h3>

              <div className="bg-slate-900 rounded-master p-8 text-white relative overflow-hidden shadow-lg space-y-6">
                <div className="absolute -right-10 -top-10 h-40 w-40 bg-brand-primary/20 rounded-full blur-3xl"></div>
                
                <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                  海马体遗忘因子拦截
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                    <span className="text-xs text-slate-300">待巩固错题</span>
                    <span className="text-xl font-black text-rose-400">{ctrl.quizWrongCount + ctrl.fillBlankWrongCount} 题</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                    <span className="text-xs text-slate-300">近 7 日打卡频率</span>
                    <span className="text-xl font-black text-emerald-400">92.4%</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    to="/wrong-answers"
                    className="flex-1 py-3 text-center rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-600/10 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
                  >
                    选择错题 ({ctrl.quizWrongCount})
                  </Link>
                  <Link
                    to="/wrong-answers"
                    className="flex-1 py-3 text-center rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-600/10 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
                  >
                    填空错题 ({ctrl.fillBlankWrongCount})
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ----------------------------------------------------
  // 视图渲染 2: 核心 FSM 演练工作台 (已选择材料时)
  // ----------------------------------------------------
  return (
    <AppLayout
      title={ctrl.selectedContent.title}
      showBack={true}
      onBack={ctrl.actions.goBackFromSession}
    >
      <div id="page-learning" className="max-w-4xl mx-auto px-4 py-6 space-y-8 page-fade-in">
        
        {/* Top pill capsules capsule switcher */}
        <div className="bg-white border border-workspace-border rounded-master p-2 flex flex-wrap gap-2 shadow-panel-flat">
          <button
            onClick={() => ctrl.actions.switchMode('syno')}
            className={`flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-xs font-black tracking-wide transition-all border ${
              ctrl.workbenchMode === 'syno'
                ? 'bg-brand-primary text-white border-transparent shadow-lg shadow-indigo-600/15'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            🎯 SynoMaster 词组选择
          </button>
          <button
            onClick={() => ctrl.actions.switchMode('spell')}
            className={`flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-xs font-black tracking-wide transition-all border ${
              ctrl.workbenchMode === 'spell'
                ? 'bg-brand-primary text-white border-transparent shadow-lg shadow-indigo-600/15'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            ⌨️ ChineseSpelling 拼写
          </button>
          <button
            onClick={() => ctrl.actions.switchMode('blank-choice')}
            className={`flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-xs font-black tracking-wide transition-all border ${
              ctrl.workbenchMode === 'blank-choice'
                ? 'bg-brand-primary text-white border-transparent shadow-lg shadow-indigo-600/15'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            📖 FillBlank 行内Popover
          </button>
          <button
            onClick={() => ctrl.actions.switchMode('blank-spell')}
            className={`flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-xs font-black tracking-wide transition-all border ${
              ctrl.workbenchMode === 'blank-spell'
                ? 'bg-brand-primary text-white border-transparent shadow-lg shadow-indigo-600/15'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            ✏️ FillBlank 逐字盲打
          </button>
        </div>

        {/* State Banner & Progress */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-rose-50 text-feedback-error text-[10px] font-black rounded-lg uppercase border border-rose-100">
              Hard 模式
            </span>
            <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase">
              ● FSM 状态机并发锁控制 [{ctrl.fsmState}]
            </span>
          </div>
          <div className="text-xs font-bold text-brand-primary bg-indigo-50 px-4 py-1.5 rounded-full">
            进度: {ctrl.currentIndex + 1} / {ctrl.selectedContent.keywords.length}
          </div>
        </div>

        {/* ==================================================== */}
        {/* 终极 MASTER CARD (1:1 原型高保真还原) */}
        {/* ==================================================== */}
        {ctrl.fsmState === 'SESSION_SUMMARY' ? (
          <div className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden text-center space-y-8 page-fade-in">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-indigo-500"></div>
            <span className="text-6xl">🏆</span>
            <h3 className="text-3xl font-extrabold text-slate-900">演练会话完成！</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
              今日的混合演练已圆满结束，本次会话共完成 <span className="font-bold text-brand-primary">{ctrl.selectedContent.keywords.length}</span> 个实体卡片，错误拦截 <span className="font-bold text-feedback-error">{ctrl.wrongCount}</span> 次。
            </p>
            <div className="pt-4 flex gap-4 justify-center">
              <button
                onClick={ctrl.actions.restartSession}
                className="px-8 py-4 rounded-2xl bg-brand-primary text-white text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                再次挑战
              </button>
              <button
                onClick={ctrl.actions.returnToLobby}
                className="px-8 py-4 rounded-2xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                返回控制大厅
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-6">
            
            {/* 1. SynoMaster 词组视图 (`view-syno`) */}
            {ctrl.workbenchMode === 'syno' && ctrl.currentKeyword && (
              <div
                id="view-syno"
                className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden page-fade-in"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 to-purple-600"></div>

                <div className="flex justify-between items-center mb-8">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">
                    实体 ID: syno_{ctrl.currentIndex + 8103}
                  </span>
                  {ctrl.wrongCount > 0 && (
                    <span className="text-xs text-feedback-error font-semibold">
                      ⚠️ 当前会话错题数: {ctrl.wrongCount} 次
                    </span>
                  )}
                </div>

                <div className="text-center space-y-4 mb-14">
                  <h2 className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight">
                    {ctrl.currentKeyword.term}
                  </h2>
                  <p className="text-lg text-slate-400 font-medium tracking-widest">
                    英 [əˈmiːliəreɪt] &nbsp; 美 [əˈmiːliəreɪt]
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                    请选择最具内聚性的同义核心词组：
                  </p>

                  <div className="grid grid-cols-1 gap-4">
                    {ctrl.synoOptions.map((opt, i) => {
                      const isSelected = ctrl.selectedSynoOption === i;
                      const showCorrect = ctrl.fsmState === 'EXPLANATION_ACTIVE' && opt.isCorrect;
                      const showWrong = ctrl.fsmState === 'EXPLANATION_ACTIVE' && isSelected && !opt.isCorrect;

                      let borderClass = 'border-slate-200 hover:bg-slate-50';
                      let bgClass = 'bg-white';
                      let textClass = 'text-slate-700';

                      if (showCorrect) {
                        borderClass = 'border-2 border-emerald-500';
                        bgClass = 'bg-emerald-50/40 shadow-sm';
                        textClass = 'text-emerald-900 font-bold';
                      } else if (showWrong) {
                        borderClass = 'border-2 border-rose-500';
                        bgClass = 'bg-rose-50/40';
                        textClass = 'text-rose-900 font-bold';
                      }

                      return (
                        <div
                          key={i}
                          onClick={() => ctrl.actions.selectSynoOption(i, opt.isCorrect)}
                          className={`flex items-center justify-between p-6 rounded-3xl border cursor-pointer active:scale-[0.98] transition-all ${borderClass} ${bgClass}`}
                        >
                          <div className="flex items-center gap-6">
                            <span
                              className={`h-8 w-8 flex items-center justify-center rounded-xl text-sm font-bold ${
                                showCorrect
                                  ? 'bg-emerald-500 text-white'
                                  : showWrong
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className={`text-base md:text-lg ${textClass}`}>{opt.term}</span>
                          </div>
                          {showCorrect && (
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-md tracking-wider">
                              ✨ 判定正确
                            </span>
                          )}
                          {!showCorrect && !showWrong && (
                            <span className="text-xs font-bold text-slate-300">
                              {opt.definition.substring(0, 8)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. ChineseSpelling 拼写视图 (`view-spell`) */}
            {ctrl.workbenchMode === 'spell' && ctrl.currentKeyword && (
              <div
                id="view-spell"
                className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden page-fade-in"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>

                <div className="text-center space-y-6 mb-12">
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-lg uppercase tracking-wider border border-amber-200/60">
                    主观词汇拼写检查
                  </span>
                  
                  <h3 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight leading-snug">
                    {ctrl.currentKeyword.definition}
                  </h3>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={ctrl.actions.playPronunciation}
                      className="h-12 px-5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 font-bold text-xs text-slate-600 flex items-center gap-2 transition-all active:scale-95 group"
                    >
                      <span className="group-hover:scale-110 transition-transform">🔊</span> 发音回放
                    </button>
                    {ctrl.isPlayingAudio && (
                      <div className="flex items-center gap-0.5 h-4">
                        <span className="w-0.5 h-3 bg-indigo-500 rounded-full animate-pulse"></span>
                        <span className="w-0.5 h-4 bg-indigo-500 rounded-full animate-pulse"></span>
                        <span className="w-0.5 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={ctrl.actions.submitSpelling} className="max-w-md mx-auto space-y-5">
                  <div className="relative">
                    <input
                      ref={ctrl.spellInputRef}
                      type="text"
                      value={ctrl.spellInput}
                      onChange={(e) => ctrl.actions.setSpellInput(e.target.value)}
                      disabled={ctrl.fsmState === 'EXPLANATION_ACTIVE'}
                      placeholder="键入对应的英文 Entity 单词..."
                      className={`w-full h-16 px-6 rounded-2xl border-2 bg-slate-50/50 text-xl font-bold tracking-wide text-center focus:outline-none focus:bg-white transition-all ${
                        ctrl.isSpellCorrect === true
                          ? 'border-emerald-500 bg-emerald-50/10 text-emerald-900'
                          : ctrl.isSpellCorrect === false
                          ? 'border-rose-500 bg-rose-50/10 text-rose-900'
                          : 'border-slate-200 focus:border-brand-primary'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={ctrl.fsmState === 'EXPLANATION_ACTIVE'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md hover:bg-slate-200"
                    >
                      Enter 验证契约
                    </button>
                  </div>

                  {/* Letter Placeholders */}
                  <div className="flex justify-center gap-1.5 pt-2 flex-wrap">
                    {ctrl.currentKeyword.term.split('').map((char, index) => {
                      const typed = ctrl.spellInput.charAt(index);
                      const isCorrectLetter = typed && typed.toLowerCase() === char.toLowerCase();
                      
                      return (
                        <span
                          key={index}
                          className={`w-6 h-1 rounded-full ${
                            isCorrectLetter
                              ? 'bg-brand-primary'
                              : typed
                              ? 'bg-rose-400'
                              : 'bg-slate-200'
                          }`}
                        ></span>
                      );
                    })}
                  </div>
                </form>
              </div>
            )}

            {/* 3. FillBlank 行内选择视图 (`view-blank-choice`) */}
            {ctrl.workbenchMode === 'blank-choice' && ctrl.currentKeyword && (
              <div
                id="view-blank-choice"
                className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden page-fade-in"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-indigo-500"></div>

                <div className="space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                    长篇学术文本行内划词挖空选择
                  </h3>

                  <div className="text-xl text-slate-800 leading-[2.4] tracking-wide font-normal font-['Noto_Sans_SC']">
                    {ctrl.blankSentence.leading}
                    
                    {/* Gap choice activator */}
                    <span className="relative inline-block align-middle mx-1.5">
                      <button
                        onClick={ctrl.actions.toggleBlankChoicePopover}
                        className={`inline-flex items-center justify-center min-w-[150px] h-9 px-4 rounded-full border-2 text-sm font-bold transition-all ${
                          ctrl.isBlankChoiceCorrect === true
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : ctrl.isBlankChoiceCorrect === false
                            ? 'border-rose-500 bg-rose-50 text-rose-700'
                            : 'border-dashed border-brand-primary bg-indigo-50/50 text-brand-primary'
                        }`}
                      >
                        {ctrl.selectedBlankChoice || '[ 点击防腐选词 ]'}
                      </button>

                      {/* Dropdown Popover */}
                      {ctrl.blankChoicePopoverOpen && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-11 w-52 bg-white rounded-2xl border border-slate-200 shadow-popover p-2 text-left space-y-1 z-50 animate-fade-in">
                          <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            领域模型候选集
                          </div>
                          {ctrl.blankChoiceOptions.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => ctrl.actions.selectBlankChoice(opt)}
                              className="w-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 text-left rounded-lg transition-colors flex justify-between items-center"
                            >
                              <span>{opt}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </span>

                    {ctrl.blankSentence.trailing}
                  </div>
                </div>
              </div>
            )}

            {/* 4. FillBlank 逐字盲打视图 (`view-blank-spell`) */}
            {ctrl.workbenchMode === 'blank-spell' && ctrl.currentKeyword && (
              <div
                id="view-blank-spell"
                className="bg-white rounded-[48px] p-12 md:p-16 border border-workspace-border shadow-master-card relative overflow-hidden page-fade-in"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-rose-500"></div>

                <div className="space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                    长文本主观行内逐字盲打纠错
                  </h3>

                  <div className="text-xl text-slate-800 leading-[2.4] tracking-wide font-normal">
                    {ctrl.blankSentence.leading}

                    {/* Character Grid Box */}
                    <span className="inline-flex items-center gap-1 mx-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl align-middle">
                      {ctrl.currentKeyword.term.split('').map((_, i) => {
                        const val = ctrl.blankSpellInputs[i] || '';
                        const isCorrectInput = val !== '';
                        const isErrorInput = ctrl.blankSpellErrorChar && ctrl.blankSpellErrorChar.index === i + 1;
                        
                        let borderClass = 'border-slate-200';
                        let bgClass = 'bg-white';
                        let textClass = 'text-slate-800';

                        if (isCorrectInput) {
                          borderClass = 'border-emerald-500';
                          textClass = 'text-emerald-600';
                        } else if (isErrorInput) {
                          borderClass = 'border-feedback-error';
                          bgClass = 'bg-rose-50';
                          textClass = 'text-feedback-error animate-pulse';
                        }

                        return (
                          <input
                            key={i}
                            id={`blank-char-${i}`}
                            type="text"
                            value={val || (isErrorInput ? ctrl.blankSpellErrorChar!.char : '')}
                            onChange={(e) => ctrl.actions.typeBlankChar(i, e.target.value)}
                            maxLength={1}
                            disabled={ctrl.fsmState === 'EXPLANATION_ACTIVE' || ctrl.isBlankSpellCompleted || (i > 0 && !ctrl.blankSpellInputs[i - 1])}
                            className={`w-7 h-8 text-center text-sm font-bold focus:outline-none transition-all rounded-md border ${borderClass} ${bgClass} ${textClass}`}
                            autoComplete="off"
                          />
                        );
                      })}
                    </span>

                    {ctrl.blankSentence.trailing}
                  </div>

                  {/* Inline Warning Error Popover */}
                  {ctrl.blankSpellErrorChar && (
                    <div className="flex items-center gap-2 text-xs font-bold text-feedback-error bg-rose-50 px-4 py-2.5 rounded-xl w-fit border border-rose-100 animate-bounce">
                      <span>⚠️ 字符第 {ctrl.blankSpellErrorChar.index} 位发生冲突：您键入了非预期的 '{ctrl.blankSpellErrorChar.char}'，已拦截并退回</span>
                      <button
                        type="button"
                        onClick={ctrl.actions.resetBlankSpell}
                        className="underline ml-2 text-rose-700 hover:text-rose-900"
                      >
                        重置盲打
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* 深度释义与学术链认知面板 */}
            {/* ==================================================== */}
            {ctrl.currentKeyword && (
              <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 space-y-4 page-fade-in">
                <div className="flex items-center gap-2 text-brand-primary text-[11px] font-black tracking-widest uppercase mb-1">
                  <span>💡 深度释义与学术链认知</span>
                </div>
                <p className="text-base text-slate-700 leading-relaxed font-medium">
                  <span className="text-brand-primary font-black">vt. & vi. &nbsp;</span>
                  {ctrl.currentKeyword.definition}。在正式语篇中，指将原本不利的、退化的境遇或状态改善为更为优良、合理的形态。
                </p>
                {(ctrl.currentKeyword as any).tags && (ctrl.currentKeyword as any).tags.length > 0 && (
                  <div className="flex gap-2 pt-2">
                    {((ctrl.currentKeyword as any).tags as string[]).map((tag: string, i: number) => (
                      <span key={i} className="text-[10px] font-bold bg-slate-200/60 text-slate-500 px-2 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-6 px-4">
              <button
                onClick={ctrl.actions.showContextTrace}
                className="text-xs font-bold text-slate-400 hover:text-slate-900 active:scale-95 transition-all uppercase tracking-widest"
              >
                上下文语料回溯
              </button>

              <button
                onClick={ctrl.actions.nextQuestion}
                disabled={ctrl.fsmState !== 'EXPLANATION_ACTIVE'}
                className="bg-slate-900 px-10 py-5 rounded-[24px] text-white font-bold text-lg shadow-2xl shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 active:scale-[0.98] transition-all"
              >
                熟知，下一题 →
              </button>
            </div>

          </div>
        )}

      </div>
    </AppLayout>
  );
}
