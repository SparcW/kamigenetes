import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import './DocsLayout.css';

interface DocsLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  className?: string;
}

/**
 * ドキュメントページ用のレイアウトコンポーネント
 */
export const DocsLayout: React.FC<DocsLayoutProps> = ({ 
  children, 
  showSidebar = true,
  className = '' 
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true); // デフォルトで開く

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className={`docs-layout ${className}`}>
      {showSidebar && (
        <Sidebar 
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
        />
      )}
      
      <div className={`docs-main ${showSidebar ? 'with-sidebar' : 'full-width'}`}>
        {showSidebar && (
          <button 
            className="sidebar-toggle mobile-only"
            onClick={toggleSidebar}
            aria-label="サイドバーを開く"
          >
            ☰
          </button>
        )}
        
        <main className="docs-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DocsLayout;
