import React, { useState, useRef } from 'react';
import { useWordData } from '../hooks/useWordData';
import { useToast } from '../components/ui';
import { trackEvent } from '../services/statistics/eventTracker';

interface DataImportProps {
  onImportComplete?: (stats: {
    imported: number;
    synonym: number;
    logic: number;
    attitude: number;
  }) => void;
}

export function DataImport({ onImportComplete }: DataImportProps) {
  const { dispatchData, parseTextData, loadSampleData, getStatistics } = useWordData();
  const toast = useToast();
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseJsonLikeArray = (content: string): any[] => {
    // 支持 UTF-8 BOM、单行注释和尾逗号，兼容“接近 JSON”格式的词库文件
    const sanitized = content
      .replace(/^\uFEFF/, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/,\s*([}\]])/g, '$1')
      .trim();

    const parsed = JSON.parse(sanitized);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON 数据必须是数组格式');
    }
    return parsed;
  };

  const buildPreview = (data: any[]) => ({
    total: data.length,
    synonym: data.filter(item => (item.type || 'synonym') === 'synonym').length,
    logic: data.filter(item => item.type === 'logic_cause' || item.type === 'logic_effect').length,
    attitude: data.filter(item => item.type?.startsWith('attitude_')).length,
    data
  });

  const parseTextOrJson = (input: string): any[] => {
    const trimmed = input.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      return parseJsonLikeArray(trimmed);
    }

    return parseTextData(trimmed);
  };

  // 预览导入数据
  const handlePreview = () => {
    if (importText.trim()) {
      trackEvent('import_preview_start', { source: 'text' });
      const parsedData = parseTextOrJson(importText);
      if (parsedData.length === 0) {
        toast.warning('未识别到可导入数据，请检查行文本或 JSON 数组格式');
        return;
      }
      setImportPreview(buildPreview(parsedData));
      trackEvent('import_preview_success', { total: parsedData.length });
    }
  };

  // 处理文本导入
  const handleTextImport = () => {
    if (!importText.trim()) return;
    
    setIsImporting(true);
    trackEvent('import_submit_start', { source: 'text' });
    try {
      const parsedData = parseTextOrJson(importText);
      if (parsedData.length === 0) {
        toast.warning('未识别到可导入数据，请检查行文本或 JSON 数组格式');
        return;
      }
      const result = dispatchData(parsedData);
      
      if (onImportComplete) {
        onImportComplete({
          imported: parsedData.length,
          synonym: result.synonymRepo.length,
          logic: result.logicRepo.length,
          attitude: result.attitudeRepo.length
        });
      }
      
      setImportText('');
      setImportPreview(null);
      trackEvent('import_submit_success', {
        source: 'text',
        imported: parsedData.length,
        synonym: result.synonymRepo.length,
        logic: result.logicRepo.length,
        attitude: result.attitudeRepo.length,
      });
    } catch (error) {
      console.error('导入失败:', error);
      toast.error('导入失败，请检查数据格式');
    } finally {
      setIsImporting(false);
    }
  };

  // 处理文件导入
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    trackEvent('import_parse_start', { source: 'file' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let data: any[];

        // 尝试解析为 JSON
        try {
          data = parseJsonLikeArray(content);
        } catch {
          // 如果不是 JSON，当作文本处理
          const parsedText = parseTextData(content);
          if (parsedText.length === 0) {
            throw new Error('文件既不是有效 JSON，也不是可识别的文本导入格式');
          }
          setImportText(content);
          setImportPreview(buildPreview(parsedText));
          trackEvent('import_parse_success', { source: 'file_text', total: parsedText.length });
          return;
        }

        // 预览 JSON 数据
        if (data.length === 0) {
          throw new Error('JSON 数组为空，没有可导入内容');
        }
        setImportPreview(buildPreview(data));
        trackEvent('import_parse_success', { source: 'file_json', total: data.length });
      } catch (error) {
        console.error('文件读取失败:', error);
        toast.error(`文件读取失败：${error instanceof Error ? error.message : '请检查文件格式'}`);
      }
    };

    reader.readAsText(file);
  };

  // 确认文件导入
  const handleConfirmFileImport = () => {
    if (!importPreview?.data) return;
    if (importPreview.data.length === 0) {
      toast.warning('没有可导入的数据');
      return;
    }
    
    setIsImporting(true);
    trackEvent('import_submit_start', { source: 'file' });
    try {
      const result = dispatchData(importPreview.data);
      
      if (onImportComplete) {
        onImportComplete({
          imported: importPreview.data.length,
          synonym: result.synonymRepo.length,
          logic: result.logicRepo.length,
          attitude: result.attitudeRepo.length
        });
      }
      
      setImportPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      trackEvent('import_submit_success', {
        source: 'file',
        imported: importPreview.data.length,
        synonym: result.synonymRepo.length,
        logic: result.logicRepo.length,
        attitude: result.attitudeRepo.length,
      });
    } catch (error) {
      console.error('导入失败:', error);
      toast.error('导入失败，请检查数据格式');
    } finally {
      setIsImporting(false);
    }
  };

  // 加载示例数据
  const handleLoadSampleData = () => {
    console.log('开始加载示例数据...');
    setIsImporting(true);
    try {
      trackEvent('import_sample_start');
      loadSampleData();
      const stats = getStatistics();
      console.log('示例数据加载完成，统计:', stats);
      
      if (onImportComplete) {
        onImportComplete({
          imported: 7, // 示例数据数量
          synonym: stats.synonymCount,
          logic: stats.logicCount,
          attitude: stats.attitudeCount
        });
      }
      
      toast.success('示例数据加载成功');
    } catch (error) {
      console.error('加载示例数据失败:', error);
      toast.error('加载示例数据失败');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 文件导入 */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">文件导入</h3>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              onChange={handleFileImport}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              选择文件 (JSON/TXT)
            </label>
            <p className="text-sm text-gray-500 mt-2">支持 JSON 和 TXT 格式</p>
          </div>
        </div>
      </div>

      {/* 文本导入 */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">文本导入</h3>
        <div className="space-y-4">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={`支持两种文本格式：
1) 行文本：word1,word2,word3 | 中文释义 | 分类
2) JSON 数组（可含 // 注释）

示例：
change,shift,modify | v.改变 | Week 1
due to,owing to | 表示原因 | Logic - Cause

[
  { "id": 1, "group": ["profit", "margin"], "meaning": "n.利润", "type": "synonym", "category": "Week 1" },
  { "id": 3001, "group": ["due to", "because of"], "meaning": "表示原因", "type": "logic_cause", "category": "Logic" }
]`}
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
          <div className="flex space-x-3">
            <button
              onClick={handlePreview}
              disabled={!importText.trim()}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              预览数据
            </button>
            <button
              onClick={handleTextImport}
              disabled={!importText.trim() || isImporting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? '导入中...' : '导入数据'}
            </button>
          </div>
        </div>
      </div>

      {/* 示例数据 */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">快速开始</h3>
        <button
          onClick={handleLoadSampleData}
          disabled={isImporting}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? '加载中...' : '一键导入示例数据'}
        </button>
        <p className="text-sm text-gray-500 mt-2">包含同义词、逻辑词、态度词的完整示例数据</p>
      </div>

      {/* 预览结果 */}
      {importPreview && (
        <div className="bg-blue-50 rounded-2xl p-6 shadow-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">数据预览</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{importPreview.total}</div>
              <div className="text-sm text-gray-600">总词簇</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{importPreview.synonym}</div>
              <div className="text-sm text-gray-600">同义词</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{importPreview.logic}</div>
              <div className="text-sm text-gray-600">逻辑词</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{importPreview.attitude}</div>
              <div className="text-sm text-gray-600">态度词</div>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleConfirmFileImport}
              disabled={isImporting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? '导入中...' : '确认导入'}
            </button>
            <button
              onClick={() => setImportPreview(null)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
