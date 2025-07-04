import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  chart: string;
  id?: string;
  className?: string;
}

// Mermaidの初期化（一度だけ実行）
let mermaidInitialized = false;

const initializeMermaid = () => {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'monospace',
      fontSize: 16,
      flowchart: {
        curve: 'basis',
        padding: 10,
        nodeSpacing: 50,
        rankSpacing: 50,
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
      },
      gantt: {
        titleTopMargin: 25,
        barHeight: 20,
        fontSize: 11,
        gridLineStartPadding: 35,
        leftPadding: 75,
        rightPadding: 50,
      },
    });
    mermaidInitialized = true;
  }
};

/**
 * Mermaid図表レンダリングコンポーネント
 */
export const MermaidRenderer: React.FC<MermaidRendererProps> = ({ 
  chart, 
  id = `mermaid-${Math.random().toString(36).substr(2, 9)}`, 
  className = '' 
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderMermaid = async () => {
      try {
        // Mermaidの初期化
        initializeMermaid();

        if (ref.current) {
          // 既存のSVGをクリア
          ref.current.innerHTML = '';
          
          // チャート内容の検証
          if (!chart || chart.trim() === '') {
            throw new Error('チャートの内容が空です');
          }

          console.log('Rendering Mermaid chart:', chart);
          
          // Mermaid図表をレンダリング
          const { svg } = await mermaid.render(id, chart);
          
          if (ref.current) {
            ref.current.innerHTML = svg;
            console.log('Mermaid chart rendered successfully');
          }
        }
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        
        if (ref.current) {
          ref.current.innerHTML = `
            <div class="mermaid-error" style="
              background-color: #fff3cd;
              border: 1px solid #ffeaa7;
              border-radius: 4px;
              padding: 16px;
              margin: 10px 0;
              color: #856404;
            ">
              <p style="margin: 0 0 8px 0; font-weight: bold;">⚠️ 図表の表示に失敗しました</p>
              <details style="margin-top: 8px;">
                <summary style="cursor: pointer; font-weight: bold;">詳細を表示</summary>
                <pre style="
                  background-color: #f8f9fa;
                  border: 1px solid #dee2e6;
                  border-radius: 3px;
                  padding: 8px;
                  margin-top: 8px;
                  overflow-x: auto;
                  font-size: 12px;
                ">${error instanceof Error ? error.message : 'Unknown error'}</pre>
              </details>
            </div>
          `;
        }
      }
    };

    renderMermaid();
  }, [chart, id]);

  return (
    <div 
      ref={ref} 
      className={`mermaid-container ${className}`}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '20px 0',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef',
      }}
    />
  );
};

export default MermaidRenderer;
