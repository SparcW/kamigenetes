import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

import { DocumentContent } from '../services/documentService';
import MermaidRenderer from './MermaidRenderer';
import { Breadcrumb, createDocumentBreadcrumb } from './Breadcrumb';
import './DocumentViewer.css';

interface DocumentViewerProps {
  content: DocumentContent;
  onTitleChange?: (title: string) => void;
  categoryId?: string;
  categoryName?: string;
}

/**
 * Markdownドキュメントビューアコンポーネント
 */
export const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  content, 
  onTitleChange,
  categoryId,
  categoryName 
}) => {
  const [processedContent, setProcessedContent] = useState<string>('');
  const [mermaidCharts, setMermaidCharts] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    // タイトル変更の通知
    if (onTitleChange) {
      onTitleChange(content.title);
    }

    // Mermaid図表を抽出して処理
    const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
    const charts: { [key: string]: string } = {};
    let processed = content.content;
    let match;
    let chartIndex = 0;

    while ((match = mermaidRegex.exec(content.content)) !== null) {
      const chartId = `mermaid-chart-${chartIndex}`;
      charts[chartId] = match[1];
      // Mermaid図表をプレースホルダーに置換
      processed = processed.replace(match[0], `<div data-mermaid="${chartId}"></div>`);
      chartIndex++;
    }

    setMermaidCharts(charts);
    setProcessedContent(processed);
  }, [content, onTitleChange]);

  return (
    <div className="document-viewer">
      {/* ブレッドクラム表示 */}
      <Breadcrumb 
        items={createDocumentBreadcrumb(categoryId, categoryName, content.title)}
        className="document-breadcrumb"
      />
      
      <div className="document-header">
        <h1 className="document-title">{content.title}</h1>
        <div className="document-meta">
          <span className="document-category">{content.category}</span>
          <span className="document-modified">
            最終更新: {new Date(content.lastModified).toLocaleDateString('ja-JP')}
          </span>
          {content.hasMermaid && (
            <span className="document-feature">🔷 図表含む</span>
          )}
        </div>
      </div>

      <div className="document-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // コードブロックのハイライト
            code({ className, children }) {
              const match = /language-(\w+)/.exec(className || '');
              return match ? (
                <SyntaxHighlighter
                  style={tomorrow as any}
                  language={match[1]}
                  PreTag="div"
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className}>
                  {children}
                </code>
              );
            },
            // Mermaidプレースホルダーの処理
            div({ children, ...props }) {
              const mermaidId = (props as any)['data-mermaid'];
              if (mermaidId && mermaidCharts[mermaidId]) {
                return (
                  <MermaidRenderer
                    chart={mermaidCharts[mermaidId]}
                    id={mermaidId}
                    className="document-mermaid"
                  />
                );
              }
              return <div {...props}>{children}</div>;
            },
            // リンクの処理
            a({ href, children, ...props }) {
              // 内部ドキュメントリンクの処理
              if (href?.startsWith('./') || href?.startsWith('../')) {
                // 相対パスを絶対パスに変換
                const resolvedPath = resolveDocumentPath(href, categoryId);
                return (
                  <a
                    href={resolvedPath}
                    {...props}
                    className="internal-link"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = resolvedPath;
                    }}
                  >
                    🔗 {children}
                  </a>
                );
              }
              
              // Markdown内のドキュメント参照（例: [概念](concepts/pods.md)）
              if (href?.endsWith('.md')) {
                const docPath = `/docs/${href.replace('.md', '')}`;
                return (
                  <a
                    href={docPath}
                    {...props}
                    className="document-link"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = docPath;
                    }}
                  >
                    📄 {children}
                  </a>
                );
              }
              
              // 外部リンクの場合は新しいタブで開く
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                  className="external-link"
                >
                  {children} 🔗
                </a>
              );
            },
            // 表の処理
            table({ children, ...props }) {
              return (
                <div className="table-container">
                  <table {...props}>{children}</table>
                </div>
              );
            },
            // 警告ボックス（カスタムMarkdown記法）
            blockquote({ children }) {
              return (
                <div className="markdown-blockquote">
                  {children}
                </div>
              );
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

/**
 * 相対パスを絶対ドキュメントパスに変換
 */
const resolveDocumentPath = (relativePath: string, currentCategoryId?: string): string => {
  if (relativePath.startsWith('./')) {
    // 同じカテゴリ内のドキュメント
    const fileName = relativePath.replace('./', '').replace('.md', '');
    return `/docs/${currentCategoryId}/${fileName}`;
  } else if (relativePath.startsWith('../')) {
    // 上位ディレクトリのドキュメント
    const pathParts = relativePath.replace('../', '').split('/');
    if (pathParts.length === 2) {
      // ../category/document.md の形式
      const [category, fileName] = pathParts;
      return `/docs/${category}/${fileName.replace('.md', '')}`;
    }
  }
  
  // フォールバック
  return relativePath;
};

export default DocumentViewer;
