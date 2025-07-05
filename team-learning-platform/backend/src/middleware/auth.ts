import { Request, Response, NextFunction } from 'express';

/**
 * 認証が必要なルートを保護するミドルウェア
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: '認証が必要です',
    });
  }

  next();
};

/**
 * 特定の権限が必要なルートを保護するミドルウェア
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.role) {
      return res.status(401).json({
        success: false,
        message: '認証が必要です',
      });
    }

    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).json({
        success: false,
        message: 'アクセス権限がありません',
      });
    }

    next();
  };
};

/**
 * 自分のリソースまたは管理者のみアクセス可能
 */
export const requireOwnerOrAdmin = (userIdParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const targetUserId = req.params[userIdParam];
    const currentUserId = req.session.userId;
    const currentUserRole = req.session.role;

    if (targetUserId === currentUserId ||
        ['super_admin', 'team_manager'].includes(currentUserRole || '')) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'アクセス権限がありません',
    });
  };
};

/**
 * チーム管理者またはスーパー管理者のみアクセス可能
 */
export const requireTeamManagerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.session.role;

  if (['super_admin', 'team_manager'].includes(userRole || '')) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'チーム管理者またはスーパー管理者の権限が必要です',
  });
};
