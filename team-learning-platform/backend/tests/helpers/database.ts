import { PrismaClient, UserRole } from '@prisma/client';

// テスト用データベースクライアント
let prisma: PrismaClient;

export const getTestDatabase = () => {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
        }
      }
    });
  }
  return prisma;
};

// テストデータベースのクリーンアップ
export const cleanDatabase = async () => {
  const db = getTestDatabase();
  
  // 全テーブルのデータを削除（順序重要）
  await db.teamMembership.deleteMany({});
  await db.team.deleteMany({});
  await db.user.deleteMany({});
  
  console.log('🧹 テストデータベースクリーンアップ完了');
};

// テストデータベース接続切断
export const disconnectDatabase = async () => {
  if (prisma) {
    await prisma.$disconnect();
    console.log('📡 テストデータベース接続切断');
  }
};

// テストユーザー作成
export const createTestUser = async (userData: {
  email: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role?: UserRole;
}) => {
  const db = getTestDatabase();
  
  return await db.user.create({
    data: {
      email: userData.email,
      username: userData.username,
      passwordHash: userData.passwordHash,
      displayName: userData.displayName,
      role: userData.role || UserRole.USER
    }
  });
};

// テストチーム作成
export const createTestTeam = async (teamData: {
  name: string;
  description?: string;
  createdBy: string;
}) => {
  const db = getTestDatabase();
  
  return await db.team.create({
    data: {
      name: teamData.name,
      description: teamData.description || '',
      createdBy: teamData.createdBy
    }
  });
};