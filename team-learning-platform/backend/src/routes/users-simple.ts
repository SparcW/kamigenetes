import { Router, Request, Response } from 'express';
// import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
// const prisma = new PrismaClient();

/**
 * ユーザー一覧取得（一時的にモック実装）
 * GET /api/users
 */
router.get('/', requireAuth, requireRole(['super_admin', 'team_manager']), async (req: Request, res: Response) => {
  try {
    // 一時的にモックデータを返却
    const mockUsers = [
      {
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        displayName: 'Administrator',
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date()
      }
    ];

    res.json({
      success: true,
      users: mockUsers,
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      }
    });
  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * ユーザー詳細取得（一時的にモック実装）
 * GET /api/users/:id
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 一時的にモックデータを返却
    if (id === '1') {
      const mockUser = {
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        displayName: 'Administrator',
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        teams: []
      };

      res.json({
        success: true,
        user: mockUser
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
  } catch (error) {
    console.error('ユーザー詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

export default router;
