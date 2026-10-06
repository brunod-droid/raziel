import "./globals.css";

export const metadata = {
  title: "Raziel | The Concierge",
  description: "Raziel, the internal reply assistant and knowledge base for the group's customer care teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
