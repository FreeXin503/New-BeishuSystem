require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

// 如果dotenv没有加载成功，使用默认值
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mysql://root:czx503CZX@localhost:3306/czxEnglish';
}

const app = express();
const prisma = new PrismaClient();
const PORT = 3001;

const fs = require('fs');
const path = require('path');

// Memory cache for processed transaction IDs
const processedTxCache = new Set();
const FALLBACK_TX_FILE = path.join(__dirname, 'processed_transactions_fallback.json');

// Load fallback transactions from file if it exists
try {
  if (fs.existsSync(FALLBACK_TX_FILE)) {
    const data = JSON.parse(fs.readFileSync(FALLBACK_TX_FILE, 'utf8'));
    if (Array.isArray(data)) {
      data.forEach(id => processedTxCache.add(id));
    }
    console.log(`[Idempotency] Loaded ${processedTxCache.size} fallback transactions.`);
  }
} catch (err) {
  console.error('Failed to load fallback transaction file:', err);
}

// Helper to persist transaction ID in fallback cache
function saveToFallbackCache(id) {
  processedTxCache.add(id);
  try {
    fs.writeFileSync(FALLBACK_TX_FILE, JSON.stringify(Array.from(processedTxCache), null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save fallback transaction file:', err);
  }
}

/**
 * 具有幂等性保障的写操作执行器
 * @param {Object} req Express 请求对象
 * @param {Object} res Express 响应对象
 * @param {string} action 事务动作名称
 * @param {Function} businessMutation 具体的业务写操作，接收事务/普通客户端，返回要返回给前端的 JSON 数据
 */
async function runIdempotentMutation(req, res, action, businessMutation) {
  const transactionId = req.body?.transactionId || req.headers['x-transaction-id'] || null;

  // 1. 如果没有 transactionId，直接执行常规业务逻辑（不带幂等日志）
  if (!transactionId) {
    try {
      const result = await businessMutation(prisma);
      return res.json(result);
    } catch (error) {
      console.error(`Error executing non-idempotent ${action}:`, error);
      return res.status(500).json({ error: error.message });
    }
  }

  // 2. 检查内存/文件缓存（第一级防线/降级兜底）
  if (processedTxCache.has(transactionId)) {
    console.log(`[Idempotency] Transaction ${transactionId} intercepted by Memory Cache.`);
    return res.json({ success: true, duplicated: true });
  }

  // 3. 尝试在数据库中执行原子事务
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 检查 ProcessedTransaction 表
      const existing = await tx.processedTransaction.findUnique({
        where: { id: transactionId }
      });

      if (existing) {
        return { isDuplicated: true };
      }

      // 执行具体的业务数据库操作
      const bizResult = await businessMutation(tx);

      // 注册 ProcessedTransaction
      await tx.processedTransaction.create({
        data: {
          id: transactionId,
          action: action
        }
      });

      return { isDuplicated: false, bizResult };
    });

    if (result.isDuplicated) {
      console.log(`[Idempotency] Transaction ${transactionId} intercepted by DB.`);
      // 记录到内存缓存防重
      processedTxCache.add(transactionId);
      return res.json({ success: true, duplicated: true });
    }

    // 成功，也将 transactionId 加入内存缓存
    saveToFallbackCache(transactionId);
    return res.json(result.bizResult);

  } catch (dbError) {
    // 4. 数据库失败或连接断开时的容灾降级逻辑
    console.error(`[Idempotency] DB Transaction failed for ${transactionId}. Falling back to memory/JSON cache. Error:`, dbError);
    
    // 如果内存缓存中已经有了，说明这是重复请求，直接拦截
    if (processedTxCache.has(transactionId)) {
      console.log(`[Idempotency] Transaction ${transactionId} intercepted by Memory Cache in fallback mode.`);
      return res.json({ success: true, duplicated: true });
    }

    try {
      // 降级使用非事务的常规操作
      const bizResult = await businessMutation(prisma);
      
      // 写入内存/文件缓存，保证下次重复请求被拦截
      saveToFallbackCache(transactionId);
      
      return res.json(bizResult);
    } catch (fallbackError) {
      console.error(`[Idempotency] Fatal fallback error executing ${action}:`, fallbackError);
      return res.status(500).json({ error: fallbackError.message });
    }
  }
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 获取所有词汇
app.get('/api/items', async (req, res) => {
  try {
    console.log('GET /api/items - Fetching items...');
    const items = await prisma.chineseSpellingItem.findMany({
      orderBy: { sequence: 'asc' }
    });
    console.log('GET /api/items - Success, found', items.length, 'items');
    res.json(items);
  } catch (error) {
    console.error('GET /api/items - Error:', error);
    res.status(500).json({ error: error.message, details: error.toString() });
  }
});

// 批量创建词汇
app.post('/api/items', async (req, res) => {
  try {
    console.log('POST /api/items - Creating items...');
    const { items } = req.body;
    console.log('POST /api/items - Items count:', items.length);

    // 获取当前最大的sequence值
    const maxSequenceItem = await prisma.chineseSpellingItem.findFirst({
      orderBy: { sequence: 'desc' },
      select: { sequence: true }
    });
    const startSequence = (maxSequenceItem?.sequence || 0) + 1;

    const result = await prisma.chineseSpellingItem.createMany({
      data: items.map((item, index) => ({
        english: item.english,
        chinese: item.chinese,
        category: item.category,
        tags: item.tags ? JSON.stringify(item.tags) : null,
        difficulty: item.difficulty,
        sequence: startSequence + index
      }))
    });

    console.log('POST /api/items - Success, created', result.count, 'items');
    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('POST /api/items - Error:', error);
    res.status(500).json({ error: error.message, details: error.toString() });
  }
});

// 删除词汇
app.delete('/api/items/:id', async (req, res) => {
  try {
    await prisma.chineseSpellingItem.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 清空所有词汇
app.delete('/api/items', async (req, res) => {
  try {
    await prisma.chineseSpellingItem.deleteMany();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取所有收藏
app.get('/api/favorites', async (req, res) => {
  try {
    const favorites = await prisma.chineseSpellingFavorite.findMany({
      include: { item: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加收藏
app.post('/api/favorites', async (req, res) => {
  const { itemId, favoriteDate } = req.body;
  await runIdempotentMutation(req, res, 'SAVE_FAVORITE', async (tx) => {
    // 避免重复创建同一主键的收藏
    const existing = await tx.chineseSpellingFavorite.findUnique({
      where: { itemId_favoriteDate: { itemId, favoriteDate } }
    });
    if (!existing) {
      await tx.chineseSpellingFavorite.create({
        data: { itemId, favoriteDate }
      });
    }
    return { success: true };
  });
});

// 删除收藏
app.delete('/api/favorites/:itemId', async (req, res) => {
  const { itemId } = req.params;
  await runIdempotentMutation(req, res, 'DELETE_FAVORITE', async (tx) => {
    await tx.chineseSpellingFavorite.deleteMany({
      where: { itemId }
    });
    return { success: true };
  });
});

// 清空收藏
app.delete('/api/favorites', async (req, res) => {
  try {
    await prisma.chineseSpellingFavorite.deleteMany();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 按日期获取收藏
app.get('/api/favorites/:date', async (req, res) => {
  try {
    const favorites = await prisma.chineseSpellingFavorite.findMany({
      where: { favoriteDate: req.params.date },
      include: { item: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取练习进度
app.get('/api/progress/:mode', async (req, res) => {
  try {
    const progress = await prisma.chineseSpellingProgress.findUnique({
      where: { mode: req.params.mode }
    });
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存练习进度
app.post('/api/progress', async (req, res) => {
  const { mode, currentIndex, totalItems, completedCount } = req.body;
  await runIdempotentMutation(req, res, 'SAVE_PROGRESS', async (tx) => {
    const progress = await tx.chineseSpellingProgress.upsert({
      where: { mode },
      update: {
        currentIndex,
        totalItems,
        completedCount,
        lastPracticedAt: new Date()
      },
      create: {
        mode,
        currentIndex,
        totalItems,
        completedCount,
        lastPracticedAt: new Date()
      }
    });
    return progress;
  });
});

// 重置练习进度
app.delete('/api/progress/:mode', async (req, res) => {
  const { mode } = req.params;
  await runIdempotentMutation(req, res, 'DELETE_PROGRESS', async (tx) => {
    try {
      await tx.chineseSpellingProgress.delete({
        where: { mode }
      });
    } catch (e) {
      if (e.code !== 'P2025') { // 忽略未找到记录的错误以保持幂等成功
        throw e;
      }
    }
    return { success: true };
  });
});

// 获取SynoMaster练习进度
app.get('/api/synomaster/progress/:mode', async (req, res) => {
  try {
    const progress = await prisma.synomasterProgress.findUnique({
      where: { mode: req.params.mode }
    });
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存SynoMaster练习进度
app.post('/api/synomaster/progress', async (req, res) => {
  const { mode, currentIndex, totalItems, completedCount } = req.body;
  await runIdempotentMutation(req, res, 'SAVE_PROGRESS', async (tx) => {
    const progress = await tx.synomasterProgress.upsert({
      where: { mode },
      update: {
        currentIndex,
        totalItems,
        completedCount,
        lastPracticedAt: new Date()
      },
      create: {
        mode,
        currentIndex,
        totalItems,
        completedCount,
        lastPracticedAt: new Date()
      }
    });
    return progress;
  });
});

// 重置SynoMaster练习进度
app.delete('/api/synomaster/progress/:mode', async (req, res) => {
  const { mode } = req.params;
  await runIdempotentMutation(req, res, 'DELETE_PROGRESS', async (tx) => {
    try {
      await tx.synomasterProgress.delete({
        where: { mode }
      });
    } catch (e) {
      if (e.code !== 'P2025') { // 忽略未找到记录的错误以保持幂等成功
        throw e;
      }
    }
    return { success: true };
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
