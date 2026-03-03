import { useContext, useEffect, useState } from 'react'
import { AppContext } from '../App'
import { Link } from 'react-router-dom'

export default function Dashboard() {
    const { botStatus, botName, botAvatar, guilds, selectedGuild } = useContext(AppContext)
    const [members, setMembers] = useState([])
    const [pointStats, setPointStats] = useState({ totalPointsIssued: 0 })

    useEffect(() => {
        if (botStatus === 'online' && selectedGuild) {
            fetch(`/api/guilds/${selectedGuild}/members`)
                .then(r => r.json())
                .then(setMembers)
                .catch(() => setMembers([]))
            fetch(`/api/points/stats?guildId=${selectedGuild}`)
                .then(r => r.json())
                .then(setPointStats)
                .catch(() => { })
        }
    }, [botStatus, selectedGuild])

    const currentGuild = guilds.find(g => g.id === selectedGuild)

    const stats = botStatus === 'online' ? [
        { icon: '🌐', label: '参加サーバー数', value: guilds.length, bg: 'rgba(124, 92, 252, 0.15)' },
        { icon: '👥', label: 'メンバー数', value: currentGuild?.memberCount || 0, bg: 'rgba(77, 184, 255, 0.15)' },
        { icon: '⭐', label: '総ポイント発行', value: pointStats.totalPointsIssued || 0, bg: 'rgba(255, 179, 71, 0.15)' },
        { icon: '👑', label: 'ロール数', value: currentGuild?.roles?.length || 0, bg: 'rgba(255, 107, 107, 0.15)' },
    ] : [
        { icon: '⚡', label: 'コマンド数', value: '-', bg: 'rgba(124, 92, 252, 0.15)' },
        { icon: '💬', label: '自動応答', value: '-', bg: 'rgba(0, 212, 170, 0.15)' },
        { icon: '⭐', label: '総ポイント発行', value: '-', bg: 'rgba(255, 179, 71, 0.15)' },
        { icon: '👥', label: 'メンバー数', value: '-', bg: 'rgba(77, 184, 255, 0.15)' },
    ]

    const quickActions = [
        { icon: '⌨️', label: 'コマンドを追加', desc: '新しいスラッシュコマンドを作成', path: '/commands' },
        { icon: '⭐', label: 'ポイント設定', desc: 'ポイントルールをカスタマイズ', path: '/points' },
        { icon: '🎨', label: 'Embed作成', desc: 'リッチなメッセージを作る', path: '/embed' },
        { icon: '🛡️', label: 'モデレーション', desc: 'サーバーを安全に保つ', path: '/moderation' },
    ]

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>ダッシュボード</h1>
                <p>
                    {botStatus === 'online' && currentGuild
                        ? `${currentGuild.name} の管理画面`
                        : 'ボットの状態と統計を一目で確認できます'}
                </p>
            </div>

            {botStatus === 'offline' && (
                <div className="card" style={{
                    marginBottom: 'var(--spacing-xl)',
                    background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.1) 0%, rgba(0, 212, 170, 0.05) 100%)',
                    borderColor: 'rgba(124, 92, 252, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                        <div style={{ fontSize: '2.5rem' }}>🚀</div>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ marginBottom: '4px' }}>ボットを始めよう！</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                ボットトークンを設定して、あなただけのDiscordボットを作り始めましょう。
                            </p>
                        </div>
                        <Link to="/setup" className="btn btn-primary btn-lg">
                            🔧 セットアップ開始
                        </Link>
                    </div>
                </div>
            )}

            <div className="stats-grid">
                {stats.map((stat, i) => (
                    <div className="stat-card" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="stat-icon" style={{ background: stat.bg }}>{stat.icon}</div>
                        <div className="stat-value">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</div>
                        <div className="stat-label">{stat.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid-2" style={{ gap: 'var(--spacing-xl)' }}>
                {/* Server List or Quick Actions */}
                {botStatus === 'online' && guilds.length > 0 ? (
                    <div className="card">
                        <div className="card-header">
                            <h2>🌐 参加サーバー一覧</h2>
                            <span className="badge badge-accent">{guilds.length} サーバー</span>
                        </div>
                        <div className="feature-list">
                            {guilds.map((guild) => (
                                <div key={guild.id} className="feature-item" style={{
                                    borderColor: selectedGuild === guild.id ? 'var(--border-accent)' : undefined,
                                    background: selectedGuild === guild.id ? 'rgba(124, 92, 252, 0.05)' : undefined,
                                    cursor: 'pointer'
                                }}>
                                    <div className="feature-item-info">
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 'var(--radius-md)',
                                            background: guild.icon ? 'none' : `hsl(${guild.id.slice(-4) % 360}, 60%, 40%)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1rem', overflow: 'hidden', flexShrink: 0
                                        }}>
                                            {guild.icon ? (
                                                <img src={guild.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                guild.name[0]
                                            )}
                                        </div>
                                        <div className="feature-item-text">
                                            <h4>{guild.name}</h4>
                                            <p>👥 {guild.memberCount}人 · 📝 {guild.channels?.length || 0}ch · 👑 {guild.roles?.length || 0}ロール</p>
                                        </div>
                                    </div>
                                    {selectedGuild === guild.id && (
                                        <span className="badge badge-online">選択中</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="card">
                        <div className="card-header">
                            <h2>⚡ クイックアクション</h2>
                        </div>
                        <div className="feature-list">
                            {quickActions.map((action, i) => (
                                <Link to={action.path} key={i} className="feature-item" style={{ textDecoration: 'none' }}>
                                    <div className="feature-item-info">
                                        <div className="feature-item-icon">{action.icon}</div>
                                        <div className="feature-item-text">
                                            <h4>{action.label}</h4>
                                            <p>{action.desc}</p>
                                        </div>
                                    </div>
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>→</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Members or Recent Activity */}
                {botStatus === 'online' && members.length > 0 ? (
                    <div className="card">
                        <div className="card-header">
                            <h2>👥 メンバー一覧</h2>
                            <span className="badge badge-info">{members.length}人</span>
                        </div>
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <div className="feature-list">
                                {members.slice(0, 30).map((member) => (
                                    <div key={member.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                                        padding: '6px var(--spacing-md)',
                                        borderBottom: '1px solid var(--border-color)',
                                    }}>
                                        <img src={member.avatar} alt="" style={{
                                            width: 28, height: 28, borderRadius: '50%'
                                        }} onError={e => { e.target.style.display = 'none' }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {member.displayName}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                @{member.username}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '120px' }}>
                                            {member.roles.slice(0, 2).map(r => (
                                                <span key={r.id} style={{
                                                    fontSize: '0.6rem', padding: '1px 5px',
                                                    borderRadius: 'var(--radius-full)',
                                                    border: `1px solid ${r.color === '#000000' ? 'var(--border-color)' : r.color}`,
                                                    color: r.color === '#000000' ? 'var(--text-tertiary)' : r.color,
                                                    whiteSpace: 'nowrap'
                                                }}>{r.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card">
                        <div className="card-header">
                            <h2>📜 クイックアクション</h2>
                        </div>
                        <div className="feature-list">
                            {quickActions.map((action, i) => (
                                <Link to={action.path} key={i} className="feature-item" style={{ textDecoration: 'none' }}>
                                    <div className="feature-item-info">
                                        <div className="feature-item-icon">{action.icon}</div>
                                        <div className="feature-item-text">
                                            <h4>{action.label}</h4>
                                            <p>{action.desc}</p>
                                        </div>
                                    </div>
                                    <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
