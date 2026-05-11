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
  try {
    const { itemId, favoriteDate } = req.body;
    await prisma.chineseSpellingFavorite.create({
      data: { itemId, favoriteDate }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除收藏
app.delete('/api/favorites/:itemId', async (req, res) => {
  try {
    await prisma.chineseSpellingFavorite.deleteMany({
      where: { itemId: req.params.itemId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
  try {
    const { mode, currentIndex, totalItems, completedCount } = req.body;
    const progress = await prisma.chineseSpellingProgress.upsert({
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
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 重置练习进度
app.delete('/api/progress/:mode', async (req, res) => {
  try {
    await prisma.chineseSpellingProgress.delete({
      where: { mode: req.params.mode }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
  try {
    const { mode, currentIndex, totalItems, completedCount } = req.body;
    const progress = await prisma.synomasterProgress.upsert({
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
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 重置SynoMaster练习进度
app.delete('/api/synomaster/progress/:mode', async (req, res) => {
  try {
    await prisma.synomasterProgress.delete({
      where: { mode: req.params.mode }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
