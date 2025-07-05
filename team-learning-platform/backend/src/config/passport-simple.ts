import passport from 'passport';

export function configurePassport(/* prisma: PrismaClient */) {
  // Passport設定は一時的にコメントアウト（Prisma接続完了後に復活）
  console.log('Passport configuration skipped (Prisma disabled)');

  // 最低限のセッション管理設定
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    // 一時的にモックユーザー返却
    done(null, { id, username: 'mock-user', role: 'USER' });
  });
}
