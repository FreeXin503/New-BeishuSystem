/**
 * 逻辑链学习组件
 */

import { useState, useEffect, useCallback } from 'react';
import type { LogicChain as LogicChainType, LogicNode, ModeProgress } from '../../types';
import { validateLogicChainOrder } from '../../services/learning/logicChain';

interface LogicChainProps {
  chain: LogicChainType;
  onComplete: (result: ModeProgress) => void;
}

const NODE_TYPE_COLORS: Record<LogicNode['type'], string> = {
  concept: '#3b82f6',    // 蓝色
  premise: '#8b5cf6',    // 紫色
  evidence: '#10b981',   // 绿色
  conclusion: '#f59e0b', // 橙色
};

const NODE_TYPE_LABELS: Record<LogicNode['type'], string> = {
  concept: '概念',
  premise: '前提',
  evidence: '论据',
  conclusion: '结论',
};

export default function LogicChain({ chain, onComplete }: LogicChainProps) {
  const [shuffledNodes, setShuffledNodes] = useState<LogicNode[]>([]);
  const [userOrder, setUserOrder] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; score: number } | null>(null);
  const [startTime] = useState(Date.now());
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    // 打乱节点顺序
    const shuffled = [...chain.nodes].sort(() => Math.random() - 0.5);
    setShuffledNodes(shuffled);
    setUserOrder([]);
    setShowResult(false);
    setResult(null);
  }, [chain]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (showResult) return;

    setUserOrder(prev => {
      if (prev.includes(nodeId)) {
        return prev.filter(id => id !== nodeId);
      }
      return [...prev, nodeId];
    });
  }, [showResult]);

  const handleDragStart = (nodeId: string) => {
    setDraggedId(nodeId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setUserOrder(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedId);
      const targetIndex = newOrder.indexOf(targetId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedId);
      }
      return newOrder;
    });
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const handleSubmit = () => {
    const validation = validateLogicChainOrder(chain, userOrder);
    setResult(validation);
    setShowResult(true);
  };

  const handleComplete = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    onComplete({
      total: chain.nodes.length,
      completed: chain.nodes.length,
      correct: result?.isCorrect ? chain.nodes.length : 0,
      timeSpent,
    });
  };

  const handleReset = () => {
    const shuffled = [...chain.nodes].sort(() => Math.random() - 0.5);
    setShuffledNodes(shuffled);
    setUserOrder([]);
    setShowResult(false);
    setResult(null);
  };

  const availableNodes = shuffledNodes.filter(n => !userOrder.includes(n.id));
  const selectedNodes = userOrder.map(id => chain.nodes.find(n => n.id === id)!).filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto">
      {/* 标题 */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-card)' }}>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          {chain.title}
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
          请按正确的逻辑顺序排列以下节点，点击节点添加到序列中
        </p>
      </div>

      {/* 图例 */}
      <div className="mb-4 flex flex-wrap gap-3">
        {Object.entries(NODE_TYPE_LABELS).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: NODE_TYPE_COLORS[type as LogicNode['type']] }}
            />
            <span style={{ color: 'var(--color-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* 已选择的节点序列 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          你的排序 ({userOrder.length}/{chain.nodes.length})
        </h3>
        <div
          className="min-h-[100px] p-4 rounded-lg border-2 border-dashed"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
        >
          {selectedNodes.length === 0 ? (
            <p className="text-center" style={{ color: 'var(--color-secondary)' }}>
              点击下方节点添加到序列
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedNodes.map((node, index) => (
                <div
                  key={node.id}
                  draggable={!showResult}
                  onDragStart={() => handleDragStart(node.id)}
                  onDragOver={(e) => handleDragOver(e, node.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => !showResult && handleNodeClick(node.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-transform hover:scale-105"
                  style={{
                    backgroundColor: showResult
                      ? result?.isCorrect || chain.nodes[index]?.id === node.id
                        ? 'var(--color-success)'
                        : 'var(--color-error)'
                      : NODE_TYPE_COLORS[node.type],
                    color: 'white',
                    opacity: draggedId === node.id ? 0.5 : 1,
                  }}
                >
                  <span className="font-bold">{index + 1}.</span>
                  <span>{node.content}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 可选节点 */}
      {!showResult && availableNodes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
            可选节点
          </h3>
          <div className="flex flex-wrap gap-2">
            {availableNodes.map(node => (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                className="px-3 py-2 rounded-lg transition-transform hover:scale-105"
                style={{
                  backgroundColor: NODE_TYPE_COLORS[node.type],
                  color: 'white',
                }}
              >
                {node.content}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 结果显示 */}
      {showResult && result && (
        <div
          className="mb-6 p-4 rounded-lg"
          style={{
            backgroundColor: result.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${result.isCorrect ? 'var(--color-success)' : 'var(--color-error)'}`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {result.isCorrect ? (
              <svg className="w-6 h-6" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" style={{ color: 'var(--color-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-bold" style={{ color: result.isCorrect ? 'var(--color-success)' : 'var(--color-error)' }}>
              {result.isCorrect ? '完全正确！' : `得分: ${result.score}%`}
            </span>
          </div>
          {!result.isCorrect && (
            <div className="mt-3">
              <p className="text-sm mb-2" style={{ color: 'var(--color-text)' }}>正确顺序：</p>
              <div className="flex flex-wrap gap-2">
                {chain.nodes.sort((a, b) => a.order - b.order).map((node, index) => (
                  <div
                    key={node.id}
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: NODE_TYPE_COLORS[node.type], color: 'white' }}
                  >
                    <span className="font-bold">{index + 1}.</span> {node.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        {!showResult ? (
          <button
            onClick={handleSubmit}
            disabled={userOrder.length !== chain.nodes.length}
            className="flex-1 py-3 rounded-lg font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            提交答案
          </button>
        ) : (
          <>
            <button
              onClick={handleReset}
              className="flex-1 py-3 rounded-lg font-medium"
              style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              重新练习
            </button>
            <button
              onClick={handleComplete}
              className="flex-1 py-3 rounded-lg font-medium text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              完成
            </button>
          </>
        )}
      </div>
    </div>
  );
}
