// hands-on/jamstack-app/api/src/types/index.ts

// アプリケーションで使用する型定義を含むファイルです。

// データベースのテーブルに対応する型定義
export interface MyTable {
    id: number;
    name: string;
}

// APIレスポンスの型定義
export interface ApiResponse<T> {
    data: T;
    message: string;
}

// ヘルスチェックのレスポンス型定義
export interface HealthCheckResponse {
    status: string;
    timestamp: string;
}