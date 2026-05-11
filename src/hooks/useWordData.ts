import { useState, useEffect, useCallback } from 'react';

export interface WordCluster {
  id: string;
  group: string[];
  meaning: string;
  category: string;
  type: 'synonym' | 'logic_cause' | 'logic_effect' | 'attitude_positive' | 'attitude_negative' | 'attitude_neutral';
}

interface WordDataRepo {
  synonymRepo: WordCluster[];
  logicRepo: WordCluster[];
  attitudeRepo: WordCluster[];
}

const STORAGE_KEYS = {
  SYNONYM: 'synomaster_synonym_data',
  LOGIC: 'synomaster_logic_data', 
  ATTITUDE: 'synomaster_attitude_data',
} as const;

// 默认示例数据
const SAMPLE_DATA: WordCluster[] = [
  {
    id: '1',
    group: ['profit', 'margin'],
    meaning: 'n.利润',
    category: 'Week 1',
    type: 'synonym'
  },
  {
    id: '2', 
    group: ['change', 'shift', 'modify', 'alter', 'transform', 'adjust', 'adapt'],
    meaning: 'v.改变',
    category: 'Week 1',
    type: 'synonym'
  },
  {
    id: '3',
    group: ['due to', 'owing to', 'thanks to', 'because of', 'on account of'],
    meaning: '由于 (原因)',
    category: 'Logic - Cause',
    type: 'logic_cause'
  },
  {
    id: '4',
    group: ['thus', 'therefore', 'hence', 'consequently', 'as a result'],
    meaning: '因此 (结果)',
    category: 'Logic - Effect',
    type: 'logic_effect'
  },
  {
    id: '5',
    group: ['optimistic', 'hopeful', 'positive', 'cheerful'],
    meaning: 'adj.乐观的',
    category: 'Attitude - Positive',
    type: 'attitude_positive'
  },
  {
    id: '6',
    group: ['indifferent', 'carefree', 'detached'],
    meaning: 'adj.冷漠的',
    category: 'Attitude - Negative',
    type: 'attitude_negative'
  },
  {
    id: '7',
    group: ['neutral', 'impartial', 'objective'],
    meaning: 'adj.中立的',
    category: 'Attitude - Neutral',
    type: 'attitude_neutral'
  }
];

export function useWordData() {
  const [wordDataRepo, setWordDataRepo] = useState<WordDataRepo>({
    synonymRepo: [],
    logicRepo: [],
    attitudeRepo: []
  });
  const [isLoading, setIsLoading] = useState(true);

  // 从本地存储加载数据
  const loadFromStorage = useCallback(() => {
    try {
      const synonymRepo = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNONYM) || '[]');
      const logicRepo = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGIC) || '[]');
      const attitudeRepo = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTITUDE) || '[]');
      
      setWordDataRepo({
        synonymRepo,
        logicRepo,
        attitudeRepo
      });
    } catch (error) {
      console.error('加载数据失败:', error);
      // 如果本地没有数据，设置空数组
      setWordDataRepo({
        synonymRepo: [],
        logicRepo: [],
        attitudeRepo: []
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载示例数据
  const loadSampleData = () => {
    try {
      dispatchData(SAMPLE_DATA);
      console.log('示例数据加载成功');
    } catch (error) {
      console.error('加载示例数据失败:', error);
      throw error;
    }
  };

  // 智能分发数据
  const dispatchData = (uploadedData: any[]) => {
    console.log('开始分发数据，总数:', uploadedData.length);
    const processedData: WordDataRepo = {
      synonymRepo: [],
      logicRepo: [],
      attitudeRepo: []
    };

    const seenIds = new Set<string>();
    const seenGroups = new Set<string>();

    uploadedData.forEach(item => {
      // 容错处理：如果没有 type 字段，默认为 synonym
      const type = item.type || 'synonym';
      
      // 生成唯一 ID（如果没有提供）
      const id = item.id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 去重处理
      const groupKey = item.group?.sort().join(',') || '';
      if (seenIds.has(id) || seenGroups.has(groupKey)) {
        return; // 跳过重复数据
      }
      
      seenIds.add(id);
      seenGroups.add(groupKey);

      const wordCluster: WordCluster = {
        id,
        group: Array.isArray(item.group) ? item.group : [item.group],
        meaning: item.meaning || item.meaning_cn || '',
        category: item.category || item.category_name || '',
        type: type as WordCluster['type']
      };

      // 根据 type 分发到对应的仓库
      switch (type) {
        case 'synonym':
          processedData.synonymRepo.push(wordCluster);
          break;
        case 'logic_cause':
        case 'logic_effect':
          processedData.logicRepo.push(wordCluster);
          break;
        case 'attitude_positive':
        case 'attitude_negative':
        case 'attitude_neutral':
          processedData.attitudeRepo.push(wordCluster);
          break;
        default:
          // 未知类型默认归类到同义词
          processedData.synonymRepo.push(wordCluster);
      }
    });

    console.log('分发结果:', {
      synonym: processedData.synonymRepo.length,
      logic: processedData.logicRepo.length,
      attitude: processedData.attitudeRepo.length
    });

    // 保存到本地存储
    localStorage.setItem(STORAGE_KEYS.SYNONYM, JSON.stringify(processedData.synonymRepo));
    localStorage.setItem(STORAGE_KEYS.LOGIC, JSON.stringify(processedData.logicRepo));
    localStorage.setItem(STORAGE_KEYS.ATTITUDE, JSON.stringify(processedData.attitudeRepo));

    setWordDataRepo(processedData);
    return processedData;
  };

  // 解析导入的文本数据
  const parseTextData = (text: string): WordCluster[] => {
    const lines = text.trim().split('\n');
    const parsedData: WordCluster[] = [];

    lines.forEach((line, index) => {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length >= 3) {
        const words = parts[0].split(',').map(word => word.trim()).filter(Boolean);
        const meaning = parts[1];
        const category = parts[2];
        
        // 简单的类型推断逻辑
        let type: WordCluster['type'] = 'synonym';
        if (category.toLowerCase().includes('logic') || category.toLowerCase().includes('cause') || category.toLowerCase().includes('effect')) {
          type = category.toLowerCase().includes('cause') ? 'logic_cause' : 'logic_effect';
        } else if (category.toLowerCase().includes('attitude') || category.toLowerCase().includes('positive') || category.toLowerCase().includes('negative') || category.toLowerCase().includes('neutral')) {
          if (category.toLowerCase().includes('positive')) type = 'attitude_positive';
          else if (category.toLowerCase().includes('negative')) type = 'attitude_negative';
          else if (category.toLowerCase().includes('neutral')) type = 'attitude_neutral';
        }

        parsedData.push({
          id: `text_${index}_${Date.now()}`,
          group: words,
          meaning,
          category,
          type
        });
      }
    });

    return parsedData;
  };

  // 清空所有数据
  const clearAllData = () => {
    localStorage.removeItem(STORAGE_KEYS.SYNONYM);
    localStorage.removeItem(STORAGE_KEYS.LOGIC);
    localStorage.removeItem(STORAGE_KEYS.ATTITUDE);
    setWordDataRepo({
      synonymRepo: [],
      logicRepo: [],
      attitudeRepo: []
    });
  };

  // 获取统计信息
  const getStatistics = () => {
    return {
      synonymCount: wordDataRepo.synonymRepo.length,
      logicCount: wordDataRepo.logicRepo.length,
      attitudeCount: wordDataRepo.attitudeRepo.length,
      totalWords: wordDataRepo.synonymRepo.reduce((sum, item) => sum + item.group.length, 0) +
                 wordDataRepo.logicRepo.reduce((sum, item) => sum + item.group.length, 0) +
                 wordDataRepo.attitudeRepo.reduce((sum, item) => sum + item.group.length, 0)
    };
  };

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return {
    wordDataRepo,
    isLoading,
    dispatchData,
    parseTextData,
    loadSampleData,
    clearAllData,
    getStatistics,
    STORAGE_KEYS,
    reloadFromStorage: loadFromStorage
  };
}
