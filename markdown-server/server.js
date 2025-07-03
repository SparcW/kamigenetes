const express = require('express');
const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// MarkdownItの設定（Mermaid対応）
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

// ミドルウェア設定
app.use(cors());
app.use(express.json());

// ドキュメント内リンクの解決関数
function resolveDocumentPath(requestPath) {
  const docsPath = '/docs';
  let targetPath = requestPath;
  
  console.log(`[DEBUG] パス解決開始: ${requestPath}`);
  
  // 先頭の / を除去
  if (targetPath.startsWith('/')) {
    targetPath = targetPath.substring(1);
  }
  
  // 空のパスの場合
  if (!targetPath) {
    console.log(`[DEBUG] 空のパス`);
    return null;
  }
  
  const fullPath = path.join(docsPath, targetPath);
  console.log(`[DEBUG] フルパス: ${fullPath}`);
  
  try {
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        console.log(`[DEBUG] ディレクトリ検出: ${fullPath}`);
        // ディレクトリの場合、README.mdまたはindex.mdを探す
        const possibleFiles = ['README.md', 'index.md'];
        for (const fileName of possibleFiles) {
          const filePath = path.join(fullPath, fileName);
          console.log(`[DEBUG] チェック中: ${filePath}`);
          if (fs.existsSync(filePath)) {
            const resolvedPath = path.join(targetPath, fileName);
            console.log(`[DEBUG] 解決成功: ${resolvedPath}`);
            return resolvedPath;
          }
        }
        console.log(`[DEBUG] ディレクトリに適切なファイルが見つからない`);
        return null;
      } else {
        console.log(`[DEBUG] ファイル検出: ${targetPath}`);
        return targetPath;
      }
    }
    
    // .mdを追加して再試行
    if (!targetPath.endsWith('.md')) {
      const mdPath = targetPath + '.md';
      const mdFullPath = path.join(docsPath, mdPath);
      console.log(`[DEBUG] .md追加試行: ${mdFullPath}`);
      if (fs.existsSync(mdFullPath)) {
        console.log(`[DEBUG] .md追加で解決: ${mdPath}`);
        return mdPath;
      }
    }
    
    console.log(`[DEBUG] パス解決失敗: ${requestPath}`);
    return null;
  } catch (error) {
    console.error(`[ERROR] パス解決エラー: ${error.message}`);
    return null;
  }
}

// 静的ファイルの提供
app.use(express.static('public'));

// ルートパス
app.get('/', (req, res) => {
  console.log(`[DEBUG] ルートパス要求`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// パス解決API
app.get('/api/resolve/*', (req, res) => {
  const requestPath = req.params[0];
  console.log(`[DEBUG] API パス解決要求: ${requestPath}`);
  
  const resolvedPath = resolveDocumentPath(requestPath);
  
  if (resolvedPath) {
    console.log(`[DEBUG] API パス解決成功: ${requestPath} -> ${resolvedPath}`);
    res.json({ 
      requestPath: requestPath,
      resolvedPath: resolvedPath,
      exists: true 
    });
  } else {
    console.log(`[DEBUG] API パス解決失敗: ${requestPath}`);
    res.status(404).json({ 
      requestPath: requestPath,
      resolvedPath: null,
      exists: false,
      message: `ドキュメント '${requestPath}' が見つかりません`
    });
  }
});

// Markdownファイルの一覧を取得
app.get('/api/files', (req, res) => {
  const docsPath = '/docs';
  console.log(`[DEBUG] ファイル一覧要求`);
  
  try {
    const getFiles = (dir, fileList = []) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          getFiles(filePath, fileList);
        } else if (path.extname(file) === '.md') {
          fileList.push({
            name: file,
            path: filePath.replace('/docs', ''),
            relativePath: path.relative('/docs', filePath),
            directory: path.dirname(filePath).replace('/docs', '') || '/'
          });
        }
      });
      
      return fileList;
    };
    
    const files = getFiles(docsPath);
    console.log(`[DEBUG] ファイル一覧取得成功: ${files.length}個のファイル`);
    res.json(files);
  } catch (error) {
    console.error('[ERROR] ファイル一覧取得エラー:', error);
    res.status(500).json({ error: 'Failed to read files' });
  }
});

// Markdownファイルの内容を取得してHTMLに変換
app.get('/api/markdown/*', (req, res) => {
  const filePath = req.params[0];
  const fullPath = path.join('/docs', filePath);
  
  console.log(`[DEBUG] Markdown API要求: ${filePath} -> ${fullPath}`);
  
  try {
    if (!fs.existsSync(fullPath)) {
      console.log(`[DEBUG] ファイルが存在しません: ${fullPath}`);
      return res.status(404).json({ error: 'File not found', path: filePath });
    }
    
    const markdownContent = fs.readFileSync(fullPath, 'utf8');
    console.log(`[DEBUG] Markdownファイル読み込み成功: ${filePath}`);
    
    // Mermaidコードブロックを保護して、markdown-itによる処理を回避
    const mermaidBlocks = [];
    let processedContent = markdownContent;
    
    // Mermaidブロックを一時的に置換トークンに変更
    processedContent = processedContent.replace(
      /```mermaid\s*\n([\s\S]*?)\n```/g,
      (match, mermaidCode) => {
        const index = mermaidBlocks.length;
        mermaidBlocks.push(mermaidCode.trim());
        return `<!--MERMAID_PLACEHOLDER_${index}-->`;
      }
    );
    
    // markdown-itでHTMLに変換
    let htmlContent = md.render(processedContent);
    
    // プレースホルダーをMermaid divに戻す
    mermaidBlocks.forEach((code, index) => {
      htmlContent = htmlContent.replace(
        `<!--MERMAID_PLACEHOLDER_${index}-->`,
        `<div class="mermaid">${code}</div>`
      );
    });
    
    res.json({
      filename: path.basename(filePath),
      path: filePath,
      markdown: markdownContent,
      html: htmlContent
    });
  } catch (error) {
    console.error('[ERROR] Markdownファイル読み込みエラー:', error);
    res.status(500).json({ error: 'Failed to read markdown file', details: error.message });
  }
});

// ドキュメント内リンクのキャッチオールルート（全てのAPIルートの後に配置）
app.get('*', (req, res) => {
  console.log(`[DEBUG] キャッチオール要求: ${req.path}`);
  
  // 静的ファイルの場合はnext()を呼ばずに404
  if (req.path.match(/\.(css|js|ico|png|jpg|gif|svg|woff|woff2|ttf|eot)$/)) {
    console.log(`[DEBUG] 静的ファイル404: ${req.path}`);
    return res.status(404).send('Not Found');
  }
  
  const resolvedPath = resolveDocumentPath(req.path);
  
  if (resolvedPath) {
    console.log(`[DEBUG] パス解決成功、SPAとして処理: ${req.path} -> ${resolvedPath}`);
    // Markdownファイルが見つかった場合、SPAとして処理
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    console.log(`[DEBUG] パス解決失敗、404: ${req.path}`);
    // ファイルが見つからない場合は404
    return res.status(404).json({ 
      error: 'Document not found',
      path: req.path,
      message: `ドキュメント '${req.path}' が見つかりません` 
    });
  }
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Kubernetes Markdown Server が起動しました`);
  console.log(`📖 URL: http://localhost:${PORT}`);
  console.log(`📁 ドキュメントパス: /docs`);
  console.log(`⚡ Mermaid図表サポート: 有効`);
  console.log(`🔧 デバッグモード: 有効`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('📴 サーバーをシャットダウンしています...');
  process.exit(0);
});
