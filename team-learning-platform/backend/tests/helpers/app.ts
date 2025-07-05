import express from 'express';
import { createTestApp } from '../fixtures/app';

// テスト用アプリケーションインスタンス
let testApp: express.Application;

export const getTestApp = () => {
  if (!testApp) {
    testApp = createTestApp();
  }
  return testApp;
};

// テスト用アプリケーションリセット
export const resetTestApp = () => {
  testApp = createTestApp();
  return testApp;
};