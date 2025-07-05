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
      fontFamily: 'inherit',
      fontSize: 16,
      flowchart: {
        curve: 'basis',
        padding: 20,
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
 * Mermaid図表レンダリングコンポーネント - 静的レンダリング方式
 */
export const MermaidRenderer: React.FC<MermaidRendererProps> = ({ 
  chart, 
  id = `mermaid-${Math.random().toString(36).substr(2, 9)}`, 
  className = '' 
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderMermaid = async () => {
      if (!ref.current || !chart?.trim()) {
        return;
      }

      try {
        // Mermaidの初期化
        initializeMermaid();

        // 既存の内容をクリア
        ref.current.innerHTML = '';
        
        // 一意なIDを生成
        const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // 方法1: mermaid.render()を使用した静的レンダリング（推奨）
        try {
          const renderResult = await mermaid.render(uniqueId, chart);
          
          // レンダリング結果を取得
          let svgContent = '';
          if (typeof renderResult === 'string') {
            svgContent = renderResult;
          } else if (renderResult && typeof renderResult === 'object') {
            // Mermaid v10以降の場合
            svgContent = (renderResult as any).svg || renderResult.toString();
          }
          
          if (svgContent && ref.current) {
            ref.current.innerHTML = svgContent;
            
            // SVGのスタイルを調整
            const svgElement = ref.current.querySelector('svg');
            if (svgElement) {
              svgElement.style.maxWidth = '100%';
              svgElement.style.height = 'auto';
              svgElement.style.display = 'block';
              svgElement.style.margin = '0 auto';
            }
            return;
          }
        } catch (renderError) {
          console.warn('mermaid.render() failed, trying alternative method:', renderError);
        }
        
        // 方法2: 従来のDOM操作方式（フォールバック）
        try {
          const tempDiv = document.createElement('div');
          tempDiv.className = 'mermaid';
          tempDiv.textContent = chart;
          tempDiv.id = uniqueId;
          
          // 隠しコンテナを作成（サイズ計算のため）
          const hiddenContainer = document.createElement('div');
          hiddenContainer.style.position = 'absolute';
          hiddenContainer.style.left = '-9999px';
          hiddenContainer.style.top = '-9999px';
          hiddenContainer.style.width = '800px';
          hiddenContainer.style.height = '600px';
          hiddenContainer.appendChild(tempDiv);
          
          // body に一時的に追加
          document.body.appendChild(hiddenContainer);
          
          // レンダリング実行
          await mermaid.init(undefined, tempDiv);
          
          // 結果をコピー
          if (ref.current && tempDiv.innerHTML) {
            ref.current.innerHTML = tempDiv.innerHTML;
            
            // SVGのスタイルを調整
            const svgElement = ref.current.querySelector('svg');
            if (svgElement) {
              svgElement.style.maxWidth = '100%';
              svgElement.style.height = 'auto';
              svgElement.style.display = 'block';
              svgElement.style.margin = '0 auto';
            }
          }
          
          // 隠しコンテナを削除
          document.body.removeChild(hiddenContainer);
          return;
          
        } catch (initError) {
          console.warn('mermaid.init() also failed:', initError);
        }
        
        // すべての方法が失敗した場合
        throw new Error('All rendering methods failed');
        
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
              text-align: left;
            ">
              <p style="margin: 0 0 8px 0; font-weight: bold;">⚠️ 図表の表示に失敗しました</p>
              <p style="margin: 0 0 8px 0; font-size: 14px;">エラー: ${error instanceof Error ? error.message : 'Unknown error'}</p>
              <details style="margin-top: 8px;">
                <summary style="cursor: pointer; font-weight: bold;">図表の内容を表示</summary>
                <pre style="
                  background-color: #f8f9fa;
                  border: 1px solid #dee2e6;
                  border-radius: 3px;
                  padding: 8px;
                  margin-top: 8px;
                  overflow-x: auto;
                  font-size: 12px;
                  white-space: pre-wrap;
                ">${chart}</pre>
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
        display: 'block',
        margin: '20px auto',
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e9ecef',
        minHeight: '100px',
        width: '100%',
        maxWidth: '100%',
        overflow: 'auto',
        textAlign: 'center',
      }}
    />
  );
};

export default MermaidRenderer;
