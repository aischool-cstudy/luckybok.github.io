// Database Types (Supabase)
export type {
  Database,
  Json,
  Profile,
  ProfileInsert,
  ProfileUpdate,
  GeneratedContent,
  GeneratedContentInsert,
  GeneratedContentUpdate,
} from './database.types';

// Domain Types
export {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_DESCRIPTIONS,
  TARGET_AUDIENCES,
  TARGET_AUDIENCE_LABELS,
  TARGET_AUDIENCE_DESCRIPTIONS,
  TARGET_AUDIENCE_ANALOGY_DOMAINS,
  AI_MODELS,
  AI_MODEL_INFO,
  PLANS,
} from './domain.types';

export type {
  SupportedLanguage,
  DifficultyLevel,
  TargetAudience,
  AIModel,
  Plan,
  CodeExample,
  QuizQuestion,
  Quiz,
  GeneratedContentStructure,
  ContentGenerationInput,
  ContentGenerationResult,
} from './domain.types';

// API Types
export {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
} from './api.types';

export type {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  ActionResult,
  GenerateContentRequest,
  GenerateContentResponse,
  StreamContentChunk,
  GetContentsParams,
  ContentListItem,
  ContentDetail,
  UserProfileResponse,
  UserStats,
  ApiErrorCode,
} from './api.types';
