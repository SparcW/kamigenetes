import { Links, Meta, Outlet, Scripts } from 'remix';
import styles from './styles.css';

export function links() {
  return [{ rel: 'stylesheet', href: styles }];
}

export function meta() {
  return {
    title: 'JAMStackアプリケーション',
    description: 'Kubernetes上で動作するJAMStackアプリケーション',
  };
}

export default function Root() {
  return (
    <html lang="ja">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}