import { useRef, useState } from 'react';
import { useWordData } from '../hooks/useWordData';
import { useToast } from '../components/ui';
import { trackEvent } from '../services/statistics/eventTracker';

interface DataImportV2Props {
  onImportComplete?: (stats: {
    imported: number;
    synonym: number;
    logic: number;
    attitude: number;
  }) => void;
}

type ParsedSuccess = {
  ok: true;
  source: 'json' | 'text';
  data: any[];
};

type ParsedFailure = {
  ok: false;
  source: 'json' | 'text';
  reason: 'empty_input' | 'json_parse_error' | 'text_parse_empty' | 'unknown';
  message: string;
};

type ParsedResult = ParsedSuccess | ParsedFailure;

const toPreview = (data: any[]) => ({
  total: data.length,
  synonym: data.filter((item) => (item.type || 'synonym') === 'synonym').length,
  logic: data.filter((item) => item.type === 'logic_cause' || item.type === 'logic_effect').length,
  attitude: data.filter((item) => String(item.type || '').startsWith('attitude_')).length,
  data,
});

export function DataImportV2({ onImportComplete }: DataImportV2Props) {
  const { dispatchData, parseTextData, loadSampleData, getStatistics } = useWordData();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<ReturnType<typeof toPreview> | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const parseJsonLikeArray = (content: string): any[] => {
    const sanitized = content
      .replace(/^\uFEFF/, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/,\s*([}\]])/g, '$1')
      .trim();

    const parsed = JSON.parse(sanitized);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON 必须是数组格式');
    }
    return parsed;
  };

  const parseInput = (input: string): ParsedResult => {
    const text = input.trim();
    if (!text) {
      return { ok: false, source: 'text', reason: 'empty_input', message: '输入为空' };
    }

    if (text.startsWith('[')) {
      try {
        const data = parseJsonLikeArray(text);
        if (data.length === 0) {
          return { ok: false, source: 'json', reason: 'json_parse_error', message: 'JSON 数组为空' };
        }
        return { ok: true, source: 'json', data };
      } catch (error) {
        return {
          ok: false,
          source: 'json',
          reason: 'json_parse_error',
          message: error instanceof Error ? error.message : 'JSON 解析失败',
        };
      }
    }

    try {
      const data = parseTextData(text);
      if (data.length === 0) {
        return {
          ok: false,
          source: 'text',
          reason: 'text_parse_empty',
          message: '未识别到有效行文本，请检查分隔符是否为 |',
        };
      }
      return { ok: true, source: 'text', data };
    } catch (error) {
      return {
        ok: false,
        source: 'text',
        reason: 'unknown',
        message: error instanceof Error ? error.message : '文本解析失败',
      };
    }
  };

  const emitImportComplete = (imported: number, result: ReturnType<typeof dispatchData>) => {
    onImportComplete?.({
      imported,
      synonym: result.synonymRepo.length,
      logic: result.logicRepo.length,
      attitude: result.attitudeRepo.length,
    });
  };

  const handlePreview = () => {
    trackEvent('import_preview_start', { source: 'text_area' });
    const parsed = parseInput(importText);

    if (!parsed.ok) {
      toast.warning(parsed.message);
      trackEvent('import_preview_fail', { source: parsed.source, reason: parsed.reason });
      return;
    }

    setImportPreview(toPreview(parsed.data));
    trackEvent('import_preview_success', { source: parsed.source, total: parsed.data.length });
  };

  const handleTextImport = () => {
    if (!importText.trim()) {
      toast.warning('请输入要导入的文本');
      trackEvent('import_submit_fail', { source: 'text_area', reason: 'empty_input' });
      return;
    }

    setIsImporting(true);
    trackEvent('import_submit_start', { source: 'text_area' });

    try {
      const parsed = parseInput(importText);
      if (!parsed.ok) {
        toast.warning(parsed.message);
        trackEvent('import_submit_fail', { source: parsed.source, reason: parsed.reason });
        return;
      }

      const result = dispatchData(parsed.data);
      emitImportComplete(parsed.data.length, result);
      setImportText('');
      setImportPreview(null);

      toast.success(`导入成功：${parsed.data.length} 条`);
      trackEvent('import_submit_success', {
        source: parsed.source,
        imported: parsed.data.length,
        synonym: result.synonymRepo.length,
        logic: result.logicRepo.length,
        attitude: result.attitudeRepo.length,
      });
    } catch (error) {
      toast.error('导入失败，请重试');
      trackEvent('import_submit_fail', { source: 'text_area', reason: 'unknown' });
      console.error('text import failed', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    trackEvent('import_parse_start', { source: 'file', ext: file.name.split('.').pop() || 'unknown' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = String(e.target?.result || '');
        const parsed = parseInput(content);

        if (!parsed.ok) {
          toast.warning(parsed.message);
          trackEvent('import_parse_fail', { source: parsed.source, reason: parsed.reason });
          return;
        }

        setImportText(content);
        setImportPreview(toPreview(parsed.data));
        trackEvent('import_parse_success', { source: parsed.source, total: parsed.data.length });
      } catch (error) {
        toast.error('文件读取失败，请检查文件内容');
        trackEvent('import_parse_fail', { source: 'file', reason: 'unknown' });
        console.error('file import failed', error);
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmFileImport = () => {
    if (!importPreview?.data?.length) {
      toast.warning('当前没有可导入的数据');
      trackEvent('import_submit_fail', { source: 'file_preview', reason: 'empty_input' });
      return;
    }

    setIsImporting(true);
    trackEvent('import_submit_start', { source: 'file_preview' });

    try {
      const result = dispatchData(importPreview.data);
      emitImportComplete(importPreview.data.length, result);
      setImportPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast.success(`导入成功：${importPreview.data.length} 条`);
      trackEvent('import_submit_success', {
        source: 'file_preview',
        imported: importPreview.data.length,
        synonym: result.synonymRepo.length,
        logic: result.logicRepo.length,
        attitude: result.attitudeRepo.length,
      });
    } catch (error) {
      toast.error('导入失败，请重试');
      trackEvent('import_submit_fail', { source: 'file_preview', reason: 'unknown' });
      console.error('confirm file import failed', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadSampleData = () => {
    setIsImporting(true);
    trackEvent('import_sample_start');

    try {
      loadSampleData();
      const stats = getStatistics();
      onImportComplete?.({
        imported: 7,
        synonym: stats.synonymCount,
        logic: stats.logicCount,
        attitude: stats.attitudeCount,
      });
      toast.success('已导入示例数据');
      trackEvent('import_sample_success', { imported: 7 });
    } catch (error) {
      toast.error('示例数据导入失败');
      trackEvent('import_sample_fail', { reason: 'unknown' });
      console.error('sample import failed', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">文件导入</h3>
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
            选择文件（JSON / TXT）
          </label>
          <p className="text-sm text-gray-500 mt-2">支持 JSON 数组和行文本格式</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">文本导入</h3>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          placeholder={`支持两种格式：
1) 行文本：word1,word2,word3 | 中文释义 | 分类
2) JSON 数组（可含 // 注释）

示例：
change,shift,modify | v.改变 | Week 1
due to,owing to | 表示原因 | Logic - Cause

[
  { "id": 1, "group": ["profit", "margin"], "meaning": "n.利润", "type": "synonym", "category": "Week 1" },
  { "id": 3001, "group": ["due to", "because of"], "meaning": "表示原因", "type": "logic_cause", "category": "Logic" }
]`}
        />
        <div className="mt-4 flex gap-3">
          <button
            onClick={handlePreview}
            disabled={!importText.trim()}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            预览数据
          </button>
          <button
            onClick={handleTextImport}
            disabled={!importText.trim() || isImporting}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isImporting ? '导入中...' : '导入数据'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">快速开始</h3>
        <button
          onClick={handleLoadSampleData}
          disabled={isImporting}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {isImporting ? '加载中...' : '一键导入示例数据'}
        </button>
      </div>

      {importPreview && (
        <div className="bg-blue-50 rounded-2xl p-6 shadow-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">数据预览</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{importPreview.total}</div>
              <div className="text-sm text-gray-600">总词组</div>
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
          <div className="flex gap-3">
            <button
              onClick={handleConfirmFileImport}
              disabled={isImporting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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

