import { NavLink } from 'react-router-dom'
import { useContext } from 'react'
import { AppContext } from '../App'

const navItems = [
    {
        section: 'メイン', items: [
            { path: '/', icon: '📊', label: 'ダッシュボード' },
            { path: '/setup', icon: '⚙️', label: 'ボット設定' },
        ]
    },
    {
        section: 'ボット機能', items: [
            { path: '/commands', icon: '⌨️', label: 'コマンドビルダー' },
            { path: '/auto-response', icon: '💬', label: '自動応答' },
            { path: '/welcome', icon: '👋', label: '入退室メッセージ' },
            { path: '/scheduled', icon: '⏰', label: '定時メッセージ' },
            { path: '/moderation', icon: '🛡️', label: 'モデレーション' },
            { path: '/embed', icon: '🎨', label: 'Embedビルダー' },
        ]
    },
    {
        section: 'ポイント & ランク', items: [
            { path: '/points', icon: '⭐', label: 'ポイント設定' },
            { path: '/ranks', icon: '🏅', label: 'ランクシステム' },
            { path: '/leaderboard', icon: '🏆', label: 'リーダーボード' },
            { path: '/rewards', icon: '🎁', label: '報酬・還元' },
        ]
    },
]

export default function Sidebar() {
    const { botStatus, botName, botAvatar, guilds, selectedGuild, setSelectedGuild } = useContext(AppContext)

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">🤖</div>
                    <div>
                        <h1>BotForge</h1>
                        <span>Discord Bot ビルダー</span>
                    </div>
                </div>
            </div>

            <div className="bot-status-widget">
                <div className="flex-row" style={{ marginBottom: '6px' }}>
                    {botAvatar ? (
                        <img src={botAvatar} alt="" style={{
                            width: 20, height: 20, borderRadius: '50%'
                        }} />
                    ) : (
                        <span className={`bot-status-dot ${botStatus}`}></span>
                    )}
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {botStatus === 'online' ? 'オンライン' : 'オフライン'}
                    </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {botName || '未設定'}
                </div>

                {/* Server selector */}
                {botStatus === 'online' && guilds.length > 0 && (
                    <select
                        value={selectedGuild || ''}
                        onChange={e => setSelectedGuild(e.target.value)}
                        style={{
                            marginTop: '8px', width: '100%', padding: '6px 8px',
                            background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                            fontSize: '0.78rem', cursor: 'pointer',
                            appearance: 'none',
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239898b0\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 6px center'
                        }}
                    >
                        {guilds.map(g => (
                            <option key={g.id} value={g.id}>
                                {g.name} ({g.memberCount}人)
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {navItems.map((section) => (
                <div className="sidebar-section" key={section.section}>
                    <div className="sidebar-section-title">{section.section}</div>
                    <nav className="sidebar-nav">
                        {section.items.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/'}
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            >
                                <span className="link-icon">{item.icon}</span>
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            ))}

            <div className="sidebar-footer">
                <div className="sidebar-creator">
                    <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                        background: 'linear-gradient(135deg, #b8a0d8 0%, #8e7cb8 50%, #d4bfa0 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.1rem', flexShrink: 0
                    }}>👴</div>
                    <div className="sidebar-creator-info">
                        <div className="creator-name">テクじい</div>
                        <div className="creator-label">開発者</div>
                    </div>
                </div>
            </div>
        </aside>
    )
}
