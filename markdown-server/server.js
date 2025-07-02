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

// 静的ファイルの提供
app.use(express.static('public'));
app.use(cors());
app.use(express.json());

// ルートパス
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Markdownファイルの一覧を取得
app.get('/api/files', (req, res) => {
  const docsPath = '/docs'; // Kubernetes Volumeでマウントされるパス
  
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
    res.json(files);
  } catch (error) {
    console.error('Error reading files:', error);
    res.status(500).json({ error: 'Failed to read files' });
  }
});

// Markdownファイルの内容を取得してHTMLに変換
app.get('/api/markdown/*', (req, res) => {
  const filePath = req.params[0];
  const fullPath = path.join('/docs', filePath);
  
  try {
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const markdownContent = fs.readFileSync(fullPath, 'utf8');
    
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
    console.error('Error reading markdown file:', error);
    res.status(500).json({ error: 'Failed to read markdown file' });
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Kubernetes Markdown Server が起動しました`);
  console.log(`📖 URL: http://localhost:${PORT}`);
  console.log(`📁 ドキュメントパス: /docs`);
  console.log(`⚡ Mermaid図表サポート: 有効`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('📴 サーバーをシャットダウンしています...');
  process.exit(0);
});
