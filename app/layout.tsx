import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StyleLens — URL로 만드는 스타일 가이드",
  description: "웹사이트의 색상, 폰트, 아이콘과 UI 스타일을 발견하고 편집 가능한 디자인 가이드로 정리하세요.",
  openGraph: { title: "StyleLens — URL로 만드는 스타일 가이드", description: "컬러부터 타이포그래피까지, 웹사이트의 디자인 언어를 한눈에.", images: ["/og.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
