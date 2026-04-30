import './globals.css';
import { GenerationProvider } from '@/context/GenerationContext';

export const metadata = {
  title: 'My Apps',
  description: 'App launcher',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <GenerationProvider>
          {children}
        </GenerationProvider>
      </body>
    </html>
  );
}
