/**
 * API レスポンスの基本型
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

/**
 * エラーレスポンス
 */
export interface ApiError {
  success: false;
  message: string;
  error?: string;
  code?: string;
}

/**
 * ページネーション情報
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * ページネーション付きレスポンス
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationInfo;
}

/**
 * ドキュメント検索結果
 */
export interface DocumentSearchResult {
  id: string;
  name: string;
  title: string;
  path: string;
  lastModified: string;
  size: number;
  category: string;
  snippet: string;
}

/**
 * ドキュメント検索レスポンス
 */
export interface DocumentSearchResponse {
  query: string;
  category: string | null;
  results: DocumentSearchResult[];
  total: number;
}

/**
 * タグ検索レスポンス
 */
export interface TagSearchResponse {
  tags: string[];
  results: DocumentSearchResult[];
  total: number;
}
