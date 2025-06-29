import React from 'react';

const Header: React.FC = () => {
  return (
    <header>
      <h1>JAMStack アプリケーション</h1>
      <nav>
        <ul>
          <li><a href="/">ホーム</a></li>
          <li><a href="/data">データ</a></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;