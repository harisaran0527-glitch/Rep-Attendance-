import { ReactNode } from 'react';
import AppLayoutClient from './AppLayoutClient';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
