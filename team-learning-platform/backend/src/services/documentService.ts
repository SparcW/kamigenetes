import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * ドキュメント管理サービス
 * /docs配下のMarkdownファイルを管理
 */
export class DocumentService {
  private readonly docsPath: string;

  constructor() {
    // docsディレクトリのパスを設定
    // Dockerコンテナ環境では /docs にマウント
    this.docsPath = '/docs';
  }

  /**
   * ドキュメントカテゴリ一覧を取得
   */
  async getCategories(): Promise<DocumentCategory[]> {
    try {
      const entries = await readdir(this.docsPath, { withFileTypes: true });
      const categories: DocumentCategory[] = [];

      // README.mdの見出し順序に基づいた並び順を定義
      const categoryOrder = ['concepts', 'tutorials', 'tasks', 'setup', 'reference'];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const categoryPath = path.join(this.docsPath, entry.name);
          const files = await this.getFilesInCategory(entry.name);
          
          categories.push({
            id: entry.name,
            name: this.getCategoryDisplayName(entry.name),
            description: this.getCategoryDescription(entry.name),
            icon: this.getCategoryIcon(entry.name),
            files: files
          });
        }
      }

      // README.mdの見出し順序でソート
      return categories.sort((a, b) => {
        const aIndex = categoryOrder.indexOf(a.id);
        const bIndex = categoryOrder.indexOf(b.id);
        
        // 定義されていないカテゴリは最後に配置
        if (aIndex === -1 && bIndex === -1) return a.id.localeCompare(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        
        return aIndex - bIndex;
      });
    } catch (error) {
      console.error('ドキュメントカテゴリの取得に失敗しました:', error);
      throw new Error('ドキュメントカテゴリの取得に失敗しました');
    }
  }

  /**
   * 特定カテゴリのファイル一覧を取得
   */
  async getFilesInCategory(categoryId: string): Promise<DocumentFile[]> {
    try {
      const categoryPath = path.join(this.docsPath, categoryId);
      const entries = await readdir(categoryPath, { withFileTypes: true });
      const files: DocumentFile[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(categoryPath, entry.name);
          const stats = await stat(filePath);
          
          files.push({
            id: entry.name.replace('.md', ''),
            name: entry.name,
            title: await this.extractTitle(filePath),
            path: `${categoryId}/${entry.name}`,
            lastModified: stats.mtime,
            size: stats.size
          });
        }
      }

      // カテゴリごとの推奨順序でソート
      return this.sortFilesByCategory(files, categoryId);
    } catch (error) {
      console.error(`カテゴリ ${categoryId} のファイル取得に失敗しました:`, error);
      throw new Error(`カテゴリ ${categoryId} のファイル取得に失敗しました`);
    }
  }

  /**
   * ドキュメントの内容を取得
   */
  async getDocumentContent(categoryId: string, fileName: string): Promise<DocumentContent> {
    try {
      const filePath = path.join(this.docsPath, categoryId, fileName);
      const content = await readFile(filePath, 'utf-8');
      const stats = await stat(filePath);

      return {
        path: `${categoryId}/${fileName}`,
        title: await this.extractTitle(filePath),
        content: content,
        lastModified: stats.mtime,
        category: categoryId,
        hasMermaid: content.includes('```mermaid')
      };
    } catch (error) {
      console.error(`ドキュメント ${categoryId}/${fileName} の取得に失敗しました:`, error);
      throw new Error(`ドキュメント ${categoryId}/${fileName} の取得に失敗しました`);
    }
  }

  /**
   * ドキュメント検索
   */
  async searchDocuments(query: string, category?: string): Promise<DocumentSearchResult[]> {
    try {
      if (!query || query.trim() === '') {
        return [];
      }

      const searchQuery = query.toLowerCase();
      const results: DocumentSearchResult[] = [];

      // カテゴリが指定されている場合はそのカテゴリのみ検索
      if (category) {
        const categoryResults = await this.searchInCategory(category, searchQuery);
        results.push(...categoryResults);
      } else {
        // 全カテゴリを検索
        const categories = await this.getCategories();
        for (const cat of categories) {
          const categoryResults = await this.searchInCategory(cat.id, searchQuery);
          results.push(...categoryResults);
        }
      }

      // 関連性でソート（タイトルマッチ > 内容マッチ）
      return results.sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(searchQuery);
        const bTitle = b.title.toLowerCase().includes(searchQuery);
        
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
        
        return a.title.localeCompare(b.title);
      });
    } catch (error) {
      console.error('ドキュメント検索に失敗しました:', error);
      throw new Error('ドキュメント検索に失敗しました');
    }
  }

  /**
   * 指定カテゴリ内でのドキュメント検索
   */
  private async searchInCategory(categoryId: string, query: string): Promise<DocumentSearchResult[]> {
    const results: DocumentSearchResult[] = [];
    const categoryPath = path.join(this.docsPath, categoryId);

    try {
      const entries = await readdir(categoryPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(categoryPath, entry.name);
          const content = await readFile(filePath, 'utf8');
          
          // タイトルまたは内容に検索クエリが含まれているかチェック
          const title = await this.extractTitle(filePath);
          const titleMatch = title.toLowerCase().includes(query);
          const contentMatch = content.toLowerCase().includes(query);
          
          if (titleMatch || contentMatch) {
            const stats = await stat(filePath);
            const snippet = this.extractSnippet(content, query);
            
            results.push({
              id: entry.name.replace('.md', ''),
              name: entry.name,
              title: title,
              path: filePath,
              lastModified: stats.mtime,
              size: stats.size,
              category: categoryId,
              snippet: snippet
            });
          }
        }
      }
    } catch (error) {
      console.error(`カテゴリ ${categoryId} の検索に失敗しました:`, error);
    }

    return results;
  }

  /**
   * タグベースの検索
   */
  async searchByTags(tags: string[]): Promise<DocumentSearchResult[]> {
    try {
      const results: DocumentSearchResult[] = [];
      const categories = await this.getCategories();

      for (const category of categories) {
        for (const file of category.files) {
          const content = await this.getDocumentContent(category.id, file.name);
          
          // マークダウンからタグを抽出（例: #tag1 #tag2 形式）
          const fileTags = this.extractTags(content.content);
          
          // 指定されたタグのいずれかが含まれているかチェック
          const hasMatchingTag = tags.some(tag => 
            fileTags.some(fileTag => fileTag.toLowerCase().includes(tag.toLowerCase()))
          );
          
          if (hasMatchingTag) {
            results.push({
              id: file.id,
              name: file.name,
              title: file.title,
              path: file.path,
              lastModified: file.lastModified,
              size: file.size,
              category: category.id,
              snippet: this.extractSnippet(content.content, tags[0])
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.error('タグ検索に失敗しました:', error);
      throw new Error('タグ検索に失敗しました');
    }
  }

  /**
   * ドキュメントからタグを抽出
   */
  private extractTags(content: string): string[] {
    const tagRegex = /(?:^|\s)#([a-zA-Z0-9_-]+)/g;
    const tags: string[] = [];
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[1]);
    }
    
    return tags;
  }

  /**
   * ファイルからタイトルを抽出
   */
  private async extractTitle(filePath: string): Promise<string> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('# ')) {
          return line.substring(2).trim();
        }
      }
      
      return path.basename(filePath, '.md');
    } catch (error) {
      return path.basename(filePath, '.md');
    }
  }

  /**
   * カテゴリの表示名を取得
   */
  private getCategoryDisplayName(categoryId: string): string {
    const displayNames: Record<string, string> = {
      'concepts': '📖 概念',
      'tutorials': '🏃 チュートリアル',
      'tasks': '📋 タスク',
      'setup': '🚀 セットアップ',
      'reference': '📚 リファレンス'
    };
    
    return displayNames[categoryId] || categoryId;
  }

  /**
   * カテゴリの説明を取得
   */
  private getCategoryDescription(categoryId: string): string {
    const descriptions: Record<string, string> = {
      'concepts': 'Kubernetesの基本概念とアーキテクチャ',
      'tutorials': 'ステップバイステップの実践的な学習',
      'tasks': '特定の問題解決と運用タスク',
      'setup': 'Kubernetes環境の構築と設定',
      'reference': 'API、CLI、設定の詳細リファレンス'
    };
    
    return descriptions[categoryId] || '';
  }

  /**
   * カテゴリのアイコンを取得
   */
  private getCategoryIcon(categoryId: string): string {
    const icons: Record<string, string> = {
      'concepts': '📖',
      'tutorials': '🏃',
      'tasks': '📋',
      'setup': '🚀',
      'reference': '📚'
    };
    
    return icons[categoryId] || '📄';
  }

  /**
   * 検索結果用のスニペットを抽出
   */
  private extractSnippet(content: string, query: string): string {
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return '';

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 50);
    
    return content.substring(start, end).trim();
  }

  /**
   * カテゴリごとのファイル順序でソート
   */
  private sortFilesByCategory(files: DocumentFile[], categoryId: string): DocumentFile[] {
    // カテゴリごとの推奨ファイル順序を定義
    const fileOrders: Record<string, string[]> = {
      'concepts': [
        'README.md',
        'overview.md',
        'cluster-architecture.md', 
        'workloads.md',
        'configuration.md',
        'security.md',
        'storage.md',
        'networking.md',
        'observability.md',
        'scaling-automation.md'
      ],
      'tutorials': [
        'README.md',
        'hello-kubernetes.md',
        'kubernetes-basics.md',
        'stateless-application.md',
        'stateful-application.md',
        'service-connection.md',
        'configuration.md',
        'security.md'
      ],
      'tasks': [
        'README.md',
        'install-tools.md',
        'administer-cluster.md',
        'configure-pod-container.md',
        'monitoring-logging.md',
        'manage-objects.md',
        'manage-secrets.md',
        'run-applications.md',
        'networking.md'
      ],
      'setup': [
        'README.md',
        'learning-environment.md',
        'production-environment.md',
        'tool-configuration.md',
        'security-configuration.md'
      ],
      'reference': [
        'README.md',
        'config-files.md',
        'glossary.md'
      ]
    };

    const order = fileOrders[categoryId];
    if (!order) {
      // 順序が定義されていない場合はアルファベット順
      return files.sort((a, b) => a.name.localeCompare(b.name));
    }

    return files.sort((a, b) => {
      const aIndex = order.indexOf(a.name);
      const bIndex = order.indexOf(b.name);
      
      // 定義されていないファイルは最後に配置
      if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
  }
}

/**
 * 型定義
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
