import express from 'express';
import { DocumentService } from '../services/documentService';
import {
  documentViewsCounter,
  documentSearchCounter,
  documentSearchResultsHistogram,
  documentSearchDuration,
  documentCategoryCounter,
  documentErrorCounter,
  documentResponseTime,
  documentTagSearchCounter,
} from '../lib/metrics';

const router = express.Router();
const documentService = new DocumentService();

/**
 * ドキュメントカテゴリ一覧を取得
 * GET /api/documents/categories
 */
router.get('/categories', async (req, res) => {
  const startTime = Date.now();
  try {
    const categories = await documentService.getCategories();

    // メトリクス記録
    documentCategoryCounter.labels('all').inc();
    documentResponseTime.labels('categories', 'all').observe((Date.now() - startTime) / 1000);

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('ドキュメントカテゴリの取得エラー:', error);

    // エラーメトリクス記録
    documentErrorCounter.labels('category_fetch_error', 'all', 'categories').inc();

    res.status(500).json({
      success: false,
      message: 'ドキュメントカテゴリの取得に失敗しました',
    });
  }
});

/**
 * 特定カテゴリのファイル一覧を取得
 * GET /api/documents/categories/:categoryId/files
 */
router.get('/categories/:categoryId/files', async (req, res) => {
  const startTime = Date.now();
  try {
    const { categoryId } = req.params;
    const files = await documentService.getFilesInCategory(categoryId);

    // メトリクス記録
    documentCategoryCounter.labels(categoryId).inc();
    documentResponseTime.labels('files', categoryId).observe((Date.now() - startTime) / 1000);

    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    console.error('ファイル一覧の取得エラー:', error);

    // エラーメトリクス記録
    const { categoryId } = req.params;
    documentErrorCounter.labels('file_list_error', categoryId, 'files').inc();

    res.status(500).json({
      success: false,
      message: 'ファイル一覧の取得に失敗しました',
    });
  }
});

/**
 * ドキュメントの内容を取得
 * GET /api/documents/:categoryId/:fileName
 */
router.get('/:categoryId/:fileName', async (req, res) => {
  const startTime = Date.now();
  try {
    const { categoryId, fileName } = req.params;

    // ファイル名に.mdが含まれていない場合は追加
    const fullFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;

    const content = await documentService.getDocumentContent(categoryId, fullFileName);

    // メトリクス記録
    const userId = (req as any).user?.id || 'anonymous';
    documentViewsCounter.labels(categoryId, fullFileName, userId).inc();
    documentResponseTime.labels('content', categoryId).observe((Date.now() - startTime) / 1000);

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error('ドキュメント内容の取得エラー:', error);

    // エラーメトリクス記録
    const { categoryId } = req.params;
    documentErrorCounter.labels('content_fetch_error', categoryId, 'content').inc();

    res.status(404).json({
      success: false,
      message: 'ドキュメントが見つかりません',
    });
  }
});

/**
 * ドキュメント検索
 * GET /api/documents/search
 * Query parameters:
 * - q: 検索クエリ（必須）
 * - category: カテゴリフィルタ（オプション）
 */
router.get('/search', async (req, res) => {
  const startTime = Date.now();
  try {
    const { q: query, category } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: '検索クエリが必要です',
      });
    }

    const results = await documentService.searchDocuments(query, category as string);

    // メトリクス記録
    const categoryLabel = category as string || 'all';
    const hasResults = results.length > 0 ? 'true' : 'false';
    documentSearchCounter.labels('text_search', categoryLabel, hasResults).inc();
    documentSearchResultsHistogram.labels('text_search', categoryLabel).observe(results.length);
    documentSearchDuration.labels('text_search', categoryLabel).observe((Date.now() - startTime) / 1000);

    res.json({
      success: true,
      data: {
        query,
        category: category || null,
        results,
        total: results.length,
      },
    });
  } catch (error) {
    console.error('ドキュメント検索エラー:', error);

    // エラーメトリクス記録
    const categoryLabel = (req.query.category as string) || 'all';
    documentErrorCounter.labels('search_error', categoryLabel, 'search').inc();

    res.status(500).json({
      success: false,
      message: 'ドキュメント検索に失敗しました',
    });
  }
});

/**
 * タグベースの検索
 * GET /api/documents/search/tags
 * Query parameters:
 * - tags: カンマ区切りのタグリスト（必須）
 */
router.get('/search/tags', async (req, res) => {
  const startTime = Date.now();
  try {
    const { tags } = req.query;

    if (!tags || typeof tags !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'タグが必要です',
      });
    }

    const tagList = tags.split(',').map(tag => tag.trim());
    const results = await documentService.searchByTags(tagList);

    // メトリクス記録
    const hasResults = results.length > 0 ? 'true' : 'false';
    documentTagSearchCounter.labels(tagList.length.toString(), hasResults).inc();
    documentSearchResultsHistogram.labels('tag_search', 'all').observe(results.length);
    documentSearchDuration.labels('tag_search', 'all').observe((Date.now() - startTime) / 1000);

    res.json({
      success: true,
      data: {
        tags: tagList,
        results,
        total: results.length,
      },
    });
  } catch (error) {
    console.error('タグ検索エラー:', error);

    // エラーメトリクス記録
    documentErrorCounter.labels('tag_search_error', 'all', 'search_tags').inc();

    res.status(500).json({
      success: false,
      message: 'タグ検索に失敗しました',
    });
  }
});

export default router;
