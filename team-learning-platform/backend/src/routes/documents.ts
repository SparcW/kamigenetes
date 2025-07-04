import express from 'express';
import { DocumentService } from '../services/documentService';

const router = express.Router();
const documentService = new DocumentService();

/**
 * ドキュメントカテゴリ一覧を取得
 * GET /api/documents/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await documentService.getCategories();
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('ドキュメントカテゴリの取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ドキュメントカテゴリの取得に失敗しました'
    });
  }
});

/**
 * 特定カテゴリのファイル一覧を取得
 * GET /api/documents/categories/:categoryId/files
 */
router.get('/categories/:categoryId/files', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const files = await documentService.getFilesInCategory(categoryId);
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('ファイル一覧の取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ファイル一覧の取得に失敗しました'
    });
  }
});

/**
 * ドキュメントの内容を取得
 * GET /api/documents/:categoryId/:fileName
 */
router.get('/:categoryId/:fileName', async (req, res) => {
  try {
    const { categoryId, fileName } = req.params;
    
    // ファイル名に.mdが含まれていない場合は追加
    const fullFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    
    const content = await documentService.getDocumentContent(categoryId, fullFileName);
    
    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('ドキュメント内容の取得エラー:', error);
    res.status(404).json({
      success: false,
      message: 'ドキュメントが見つかりません'
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
  try {
    const { q: query, category } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: '検索クエリが必要です'
      });
    }

    const results = await documentService.searchDocuments(query, category as string);
    
    res.json({
      success: true,
      data: {
        query,
        category: category || null,
        results,
        total: results.length
      }
    });
  } catch (error) {
    console.error('ドキュメント検索エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ドキュメント検索に失敗しました'
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
  try {
    const { tags } = req.query;
    
    if (!tags || typeof tags !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'タグが必要です'
      });
    }

    const tagList = tags.split(',').map(tag => tag.trim());
    const results = await documentService.searchByTags(tagList);
    
    res.json({
      success: true,
      data: {
        tags: tagList,
        results,
        total: results.length
      }
    });
  } catch (error) {
    console.error('タグ検索エラー:', error);
    res.status(500).json({
      success: false,
      message: 'タグ検索に失敗しました'
    });
  }
});

export default router;
