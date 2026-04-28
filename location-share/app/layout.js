import './globals.css';

export const metadata = {
  title: 'Location Share',
  description: 'Share your live location for 30 minutes',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
