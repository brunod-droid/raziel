import "./globals.css";

export const metadata = {
  title: "theo grace | Holiday Concierge Console",
  description: "Internal reply assistant and knowledge base for theo grace customer care.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
