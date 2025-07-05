module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
  ],
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    // 基本的なルール
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'warn',
    'prefer-const': 'warn',
    'no-var': 'error',
    
    // セミコロンとクォート
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    
    // インデント
    'indent': ['error', 2],
    
    // 末尾のスペース
    'no-trailing-spaces': 'error',
    
    // 空行
    'no-multiple-empty-lines': ['error', { max: 2 }],
    
    // その他
    'comma-dangle': ['error', 'always-multiline'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.js',
  ],
  overrides: [
    {
      files: ['src/lib/prisma.ts'],
      rules: {
        'no-var': 'off',
      },
    },
  ],
};