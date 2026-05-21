/**
 * 领域模型公共 API
 * 
 * 前端组件和 Hooks 应该仅从此处导入领域类型。
 * 严禁直接导入 schema.prisma 派生类型或 src/types 中的裸类型。
 */

// ——— 拼写模块 ———
export {
  Difficulty,
  PracticeMode,
} from './SpellingEntity';

export type {
  SpellingItemEntity,
  SpellingFavoriteEntity,
  SpellingProgressEntity,
  SpellingSessionResultEntity,
} from './SpellingEntity';

// ——— Quiz 模块 ———
export {
  QuestionType,
} from './QuizEntity';

export type {
  QuestionEntity,
  QuizArchiveEntity,
  WrongAnswerEntity,
  FavoriteQuestionEntity,
  FavoriteCategoryEntity,
  QuizSessionResultEntity,
  ValidationResultVO,
} from './QuizEntity';

// ——— FillBlank 模块 ———
export type {
  FillBlankItemEntity,
  FillBlankSessionResultEntity,
  FillBlankFavoriteEntity,
  FillBlankWrongAnswerEntity,
  FillBlankImportRecordEntity,
} from './FillBlankEntity';

// ——— SynoMaster 模块 ———
export {
  WordClusterType,
} from './SynoMasterEntity';

export type {
  WordClusterEntity,
  WordDataRepoEntity,
  SynoProgressEntity,
} from './SynoMasterEntity';
