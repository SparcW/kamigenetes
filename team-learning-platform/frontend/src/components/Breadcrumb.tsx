import React from 'react';
import { Link } from 'react-router-dom';
import './Breadcrumb.css';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * ブレッドクラムナビゲーションコンポーネント
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav className={`breadcrumb ${className}`} aria-label="breadcrumb">
      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <li key={index} className={`breadcrumb-item ${isLast ? 'active' : ''}`}>
              {item.icon && (
                <span className="breadcrumb-icon">{item.icon}</span>
              )}
              
              {!isLast && item.path ? (
                <Link to={item.path} className="breadcrumb-link">
                  {item.label}
                </Link>
              ) : (
                <span className="breadcrumb-text">{item.label}</span>
              )}
              
              {!isLast && (
                <span className="breadcrumb-separator">›</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

/**
 * ドキュメント用のブレッドクラムを生成するヘルパー関数
 */
export const createDocumentBreadcrumb = (
  categoryId?: string,
  categoryName?: string,
  documentTitle?: string
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    {
      label: 'ホーム',
      path: '/',
      icon: '🏠'
    },
    {
      label: 'ドキュメント',
      path: '/docs',
      icon: '📚'
    }
  ];

  if (categoryId && categoryName) {
    items.push({
      label: categoryName,
      path: `/docs/${categoryId}`,
      icon: getCategoryIcon(categoryId)
    });
  }

  if (documentTitle) {
    items.push({
      label: documentTitle,
      icon: '📄'
    });
  }

  return items;
};

/**
 * カテゴリアイコンを取得
 */
const getCategoryIcon = (categoryId: string): string => {
  const icons: Record<string, string> = {
    'concepts': '📖',
    'tutorials': '🏃',
    'tasks': '📋',
    'setup': '🚀',
    'reference': '📚',
    'jamstack-app': '⚡',
    'api': '🔌',
    'database': '💾',
    'frontend': '🎨',
    'monitoring': '📊'
  };
  
  return icons[categoryId] || '📁';
};

export default Breadcrumb;
