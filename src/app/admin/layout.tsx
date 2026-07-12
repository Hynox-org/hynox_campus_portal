import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hynox Campus Admin Panel",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="apple-layout-theme min-h-screen bg-[#f5f5f7]">
      <style dangerouslySetInnerHTML={{ __html: `
        .apple-layout-theme {
          /* Exact colors from apple.com/in */
          --background: #f5f5f7;
          --foreground: #1d1d1f;
          --primary: #0066cc;          /* Apple Link Blue */
          --secondary: #1d1d1f;        /* Apple Obsidian */
          --accent: #86868b;           /* Apple Slate Gray */
          --surface: #ffffff;
          --muted-surface: #f5f5f7;
          --border-muted: #d2d2d7;
          --text-primary: #1d1d1f;
          --text-secondary: #86868b;
          
          /* Exact font family stack from apple.com/in */
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
          color: #1d1d1f;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .apple-layout-theme h1,
        .apple-layout-theme h2,
        .apple-layout-theme h3,
        .apple-layout-theme h4,
        .apple-layout-theme h5,
        .apple-layout-theme h6,
        .apple-layout-theme .title-font {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
          color: #1d1d1f;
          font-weight: 600;
          letter-spacing: -0.015em;
        }

        .apple-layout-theme a, 
        .apple-layout-theme .apple-link {
          color: #0066cc;
          text-decoration: none;
        }

        .apple-layout-theme a:hover, 
        .apple-layout-theme .apple-link:hover {
          text-decoration: underline;
        }

        /* Apple Cards */
        .apple-layout-theme .apple-card {
          background: #ffffff;
          border: 1px solid #d2d2d7;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .apple-layout-theme .apple-card:hover {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
          border-color: #86868b;
        }
      `}} />
      {children}
    </div>
  );
}
