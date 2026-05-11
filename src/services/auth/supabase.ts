/**
 * Supabase 客户端配置
 */

import { createClient } from '@supabase/supabase-js';

// Supabase 配置
// 注意：实际项目中应使用环境变量
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// 创建 Supabase 客户端
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// 导出类型
export type { User, Session } from '@supabase/supabase-js';
