import { ApiResponse } from '../types/api';

/**
 * ドキュメント関連の型定義
 */
export interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  files: DocumentFile[];
}

export interface DocumentFile {
  id: string;
  name: string;
  title: string;
  path: string;
  lastModified: Date;
  size: number;
}

export interface DocumentContent {
  path: string;
  title: string;
  content: string;
  lastModified: Date;
  category: string;
  hasMermaid: boolean;
}

export interface DocumentSearchResult extends DocumentFile {
  category: string;
  snippet: string;
}

/**
 * ドキュメント管理サービス
 */
export class DocumentService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = `${(import.meta as any).env.VITE_API_URL || 'http://localhost:3001'}/api/documents`;
  }

  /**
   * ドキュメントカテゴリ一覧を取得
   */
  async getCategories(): Promise<DocumentCategory[]> {
    try {
      const response = await fetch(`${this.baseUrl}/categories`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`カテゴリ取得エラー: ${response.status}`);
      }

      const data: ApiResponse<DocumentCategory[]> = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'カテゴリの取得に失敗しました');
      }

      return data.data;
    } catch (error) {
      console.error('ドキュメントカテゴリの取得エラー:', error);
      throw error;
    }
  }

  /**
   * 特定カテゴリのファイル一覧を取得
   */
  async getFilesInCategory(categoryId: string): Promise<DocumentFile[]> {
    try {
      const response = await fetch(`${this.baseUrl}/categories/${categoryId}/files`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`ファイル一覧取得エラー: ${response.status}`);
      }

      const data: ApiResponse<DocumentFile[]> = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'ファイル一覧の取得に失敗しました');
      }

      return data.data;
    } catch (error) {
      console.error('ファイル一覧の取得エラー:', error);
      throw error;
    }
  }

  /**
   * ドキュメントの内容を取得
   */
  async getDocumentContent(categoryId: string, fileName: string): Promise<DocumentContent> {
    try {
      // ファイル名から.mdを除去（APIが自動で追加）
      const cleanFileName = fileName.replace('.md', '');
      
      const response = await fetch(`${this.baseUrl}/${categoryId}/${cleanFileName}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`ドキュメント取得エラー: ${response.status}`);
      }

      const data: ApiResponse<DocumentContent> = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'ドキュメントの取得に失敗しました');
      }

      return data.data;
    } catch (error) {
      console.error('ドキュメント内容の取得エラー:', error);
      throw error;
    }
  }

  /**
   * ドキュメント検索
   */
  async searchDocuments(query: string, category?: string): Promise<DocumentSearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query
      });
      
      if (category) {
        params.append('category', category);
      }

      const response = await fetch(`${this.baseUrl}/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data: ApiResponse<{
        query: string;
        category: string | null;
        results: DocumentSearchResult[];
        total: number;
      }> = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Search failed');
      }

      return data.data.results;
    } catch (error) {
      console.error('Document search error:', error);
      throw error;
    }
  }

  /**
   * タグベースの検索
   */
  async searchByTags(tags: string[]): Promise<DocumentSearchResult[]> {
    try {
      const params = new URLSearchParams({
        tags: tags.join(',')
      });

      const response = await fetch(`${this.baseUrl}/search/tags?${params}`);
      
      if (!response.ok) {
        throw new Error(`Tag search failed: ${response.status}`);
      }

      const data: ApiResponse<{
        tags: string[];
        results: DocumentSearchResult[];
        total: number;
      }> = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Tag search failed');
      }

      return data.data.results;
    } catch (error) {
      console.error('Tag search error:', error);
      throw error;
    }
  }
}

// シングルトンインスタンス
export const documentService = new DocumentService();
