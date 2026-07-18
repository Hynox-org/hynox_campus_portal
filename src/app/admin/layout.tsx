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
    <div className="apple-layout-theme min-h-screen bg-[#1A1C22]">
      <style dangerouslySetInnerHTML={{ __html: `
        .apple-layout-theme {
          /* Exact colors from apple.com/in */
          --background: #1A1C22;
          --foreground: #EDEFF5;
          --primary: #6E79F4;          /* Apple Link Blue */
          --secondary: #EDEFF5;        /* Apple Obsidian */
          --accent: #9BA1AE;           /* Apple Slate Gray */
          --surface: #ffffff;
          --muted-surface: #1A1C22;
          --border-muted: #23252C;
          --text-primary: #EDEFF5;
          --text-secondary: #9BA1AE;
          
          /* Exact font family stack from apple.com/in */
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
          color: #EDEFF5;
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
          color: #EDEFF5;
          font-weight: 600;
          letter-spacing: -0.015em;
        }

        .apple-layout-theme a, 
        .apple-layout-theme .apple-link {
          color: #6E79F4;
          text-decoration: none;
        }

        .apple-layout-theme a:hover, 
        .apple-layout-theme .apple-link:hover {
          text-decoration: underline;
        }

        /* Apple Cards */
        .apple-layout-theme .apple-card {
          background: #ffffff;
          border: 1px solid #23252C;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .apple-layout-theme .apple-card:hover {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
          border-color: #9BA1AE;
        }
      `}} />
      {children}
    </div>
  );
}
