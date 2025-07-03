import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

export function configurePassport(prisma: PrismaClient) {
  
  // セッションにユーザーIDを保存
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // セッションからユーザー情報を復元
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          teamMemberships: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      if (user) {
        done(null, {
          id: user.id,
          username: user.username,
          role: user.role,
          teamIds: user.teamMemberships.map(tm => tm.teamId)
        });
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error, false);
    }
  });

  // ローカル認証戦略
  passport.use(new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password'
    },
    async (username, password, done) => {
      try {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: username },
              { email: username }
            ],
            isActive: true
          },
          include: {
            teamMemberships: {
              include: {
                team: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        });

        if (!user || !user.passwordHash) {
          return done(null, false, { message: 'ユーザー名またはパスワードが正しくありません' });
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
          return done(null, false, { message: 'ユーザー名またはパスワードが正しくありません' });
        }

        // ログイン時刻を更新
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });

        return done(null, {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          avatarUrl: user.avatarUrl,
          teamIds: user.teamMemberships.map(tm => tm.teamId),
          teams: user.teamMemberships.map(tm => ({
            id: tm.team.id,
            name: tm.team.name,
            role: tm.role
          }))
        });

      } catch (error) {
        return done(error);
      }
    }
  ));

  // Google OAuth戦略
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/oauth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(null, false, { message: 'Googleアカウントのメールアドレスが取得できませんでした' });
          }

          // 既存ユーザーの確認
          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: email },
                { oauthId: profile.id, oauthProvider: 'google' }
              ]
            },
            include: {
              teamMemberships: {
                include: {
                  team: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          });

          if (!user) {
            // 新規ユーザー作成
            const username = profile.username || email.split('@')[0];
            const displayName = profile.displayName || username;

            user = await prisma.user.create({
              data: {
                username: username,
                email: email,
                displayName: displayName,
                avatarUrl: profile.photos?.[0]?.value || null,
                oauthProvider: 'google',
                oauthId: profile.id,
                role: 'user',
                lastLoginAt: new Date()
              },
              include: {
                teamMemberships: {
                  include: {
                    team: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            });
          } else {
            // ログイン時刻を更新
            user = await prisma.user.update({
              where: { id: user.id },
              data: { 
                lastLoginAt: new Date(),
                avatarUrl: profile.photos?.[0]?.value || user.avatarUrl
              },
              include: {
                teamMemberships: {
                  include: {
                    team: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            });
          }

          return done(null, {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            avatarUrl: user.avatarUrl,
            teamIds: user.teamMemberships.map(tm => tm.teamId),
            teams: user.teamMemberships.map(tm => ({
              id: tm.team.id,
              name: tm.team.name,
              role: tm.role
            }))
          });

        } catch (error) {
          return done(error);
        }
      }
    ));
  }

  // GitHub OAuth戦略
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/auth/oauth/github/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(null, false, { message: 'GitHubアカウントのメールアドレスが取得できませんでした' });
          }

          // 既存ユーザーの確認
          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: email },
                { oauthId: profile.id, oauthProvider: 'github' }
              ]
            },
            include: {
              teamMemberships: {
                include: {
                  team: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          });

          if (!user) {
            // 新規ユーザー作成
            const username = profile.username || email.split('@')[0];
            const displayName = profile.displayName || username;

            user = await prisma.user.create({
              data: {
                username: username,
                email: email,
                displayName: displayName,
                avatarUrl: profile.photos?.[0]?.value || null,
                oauthProvider: 'github',
                oauthId: profile.id,
                role: 'user',
                lastLoginAt: new Date()
              },
              include: {
                teamMemberships: {
                  include: {
                    team: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            });
          } else {
            // ログイン時刻を更新
            user = await prisma.user.update({
              where: { id: user.id },
              data: { 
                lastLoginAt: new Date(),
                avatarUrl: profile.photos?.[0]?.value || user.avatarUrl
              },
              include: {
                teamMemberships: {
                  include: {
                    team: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            });
          }

          return done(null, {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            avatarUrl: user.avatarUrl,
            teamIds: user.teamMemberships.map(tm => tm.teamId),
            teams: user.teamMemberships.map(tm => ({
              id: tm.team.id,
              name: tm.team.name,
              role: tm.role
            }))
          });

        } catch (error) {
          return done(error);
        }
      }
    ));
  }
}
