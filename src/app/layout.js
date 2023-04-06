import './globals.css'

export const metadata = {
    title: '開源魔力寵次算檔機',
    description: 'Created By TonyQ',
}

export default function RootLayout({children}) {
    return (
        <html lang="zh-TW">
            <body>{children}</body>
        </html>
    )
}
