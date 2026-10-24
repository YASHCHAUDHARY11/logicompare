import './globals.css';

export const metadata = {
  title: 'LogiCompare - Freight Rate Matrix',
  description: 'B2B Logistics Comparison Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
