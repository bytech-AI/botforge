import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../App'

export default function PointLeaderboard() {
    const { botStatus, selectedGuild } = useContext(AppContext)
    const [members, setMembers] = useState([])
    const [stats, setStats] = useState({ totalPointsIssued: 0, averagePoints: 0, maxStreak: 0, rewardsClaimed: 0 })
    const [period, setPeriod] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(false)

    // Fetch leaderboard data
    useEffect(() => {
        if (botStatus === 'online' && selectedGuild) {
            setLoading(true)
            Promise.all([
                fetch(`/api/points/leaderboard?guildId=${selectedGuild}`).then(r => r.json()),
                fetch(`/api/points/stats?guildId=${selectedGuild}`).then(r => r.json()),
            ]).then(([lb, st]) => {
                setMembers(lb)
                setStats(st)
            }).catch(() => {
                setMembers([])
            }).finally(() => setLoading(false))
        } else {
            setMembers([])
        }
    }, [botStatus, selectedGuild])

    const filtered = members.filter(m =>
        (m.username || m.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getRankStyle = (rank) => {
        if (rank === 1) return { bg: 'linear-gradient(135deg, #ffd700 0%, #ffb347 100%)', color: '#000', shadow: '0 0 20px rgba(255, 215, 0, 0.3)' }
        if (rank === 2) return { bg: 'linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%)', color: '#000', shadow: '0 0 15px rgba(192, 192, 192, 0.2)' }
        if (rank === 3) return { bg: 'linear-gradient(135deg, #cd7f32 0%, #b8712d 100%)', color: '#fff', shadow: '0 0 15px rgba(205, 127, 50, 0.2)' }
        return null
    }

    const exportCSV = () => {
        if (members.length === 0) return
        const header = '順位,ユーザー名,表示名,ポイント,ランク,RP,メッセージ,リアクション,ボイス(分),連続日数\n'
        const rows = members.map((m, i) =>
            `${i + 1},${m.username},${m.display_name || m.username},${m.total_points},${m.rank_label || '-'},${m.current_rp || 0},${m.messages},${m.reactions},${m.voice_minutes},${m.streak_days}`
        ).join('\n')
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `leaderboard_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (botStatus !== 'online') {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <h1>🏆 リーダーボード</h1>
                    <p>メンバーのポイントランキングを確認できます</p>
                </div>
                <div className="empty-state">
                    <div className="empty-icon">🔗</div>
                    <h3>ボットを接続してください</h3>
                    <p>リーダーボードを表示するにはボットをサーバーに接続する必要があります</p>
                </div>
            </div>
        )
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>🏆 リーダーボード</h1>
                <p>メンバーのポイントランキングを確認できます</p>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xxl)', color: 'var(--text-tertiary)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-md)', animation: 'spin 1s linear infinite' }}>⏳</div>
                    <p>ランキングデータを読み込み中...</p>
                </div>
            ) : members.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>まだランキングデータがありません</h3>
                    <p>メンバーがサーバーで活動すると、ここにランキングが表示されます。
                        メッセージの送信やリアクションでポイントが自動で付与されます。</p>
                </div>
            ) : (
                <>
                    {/* Top 3 Podium */}
                    {members.length >= 3 && (
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)',
                            alignItems: 'flex-end'
                        }}>
                            {[members[1], members[0], members[2]].map((m, i) => {
                                if (!m) return null
                                const rank = [2, 1, 3][i]
                                const heights = ['140px', '180px', '120px']
                                const rs = getRankStyle(rank)
                                return (
                                    <div key={rank} style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        gap: 'var(--spacing-sm)'
                                    }}>
                                        <div style={{
                                            width: 56, height: 56, borderRadius: '50%',
                                            background: rs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 800, fontSize: '1.3rem', color: rs.color,
                                            boxShadow: rs.shadow, overflow: 'hidden'
                                        }}>
                                            {m.avatar ? (
                                                <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = rank === 1 ? '👑' : rank }} />
                                            ) : (
                                                rank === 1 ? '👑' : rank
                                            )}
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.display_name || m.username}</span>
                                        <span style={{ fontSize: '0.82rem', color: 'var(--accent-primary-light)', fontWeight: 700 }}>
                                            {m.total_points.toLocaleString()} pt
                                        </span>
                                        <div style={{
                                            width: rank === 1 ? '120px' : '100px',
                                            height: heights[i],
                                            background: rs.bg,
                                            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                                            opacity: 0.3
                                        }} />
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex-between mb-lg">
                        <div className="flex-row gap-md">
                            {[
                                { id: 'all', label: '全期間' },
                                { id: 'month', label: '今月' },
                                { id: 'week', label: '今週' },
                                { id: 'day', label: '今日' },
                            ].map(p => (
                                <button key={p.id}
                                    className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setPeriod(p.id)}
                                >{p.label}</button>
                            ))}
                        </div>
                        <div className="flex-row gap-md">
                            <input className="form-input" placeholder="🔍 メンバーを検索..."
                                style={{ width: '220px', padding: '8px 14px', fontSize: '0.85rem' }}
                                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            <button className="btn btn-secondary btn-sm" onClick={exportCSV}>📥 CSV出力</button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>順位</th>
                                    <th>メンバー</th>
                                    <th style={{ textAlign: 'right' }}>ポイント</th>
                                    <th style={{ textAlign: 'right' }}>ランク</th>
                                    <th style={{ textAlign: 'right' }}>メッセージ</th>
                                    <th style={{ textAlign: 'right' }}>リアクション</th>
                                    <th style={{ textAlign: 'right' }}>ボイス</th>
                                    <th style={{ textAlign: 'right' }}>連続日数</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((m, index) => {
                                    const rank = m.rank || index + 1
                                    const rs = getRankStyle(rank)
                                    return (
                                        <tr key={m.user_id}>
                                            <td>
                                                {rs ? (
                                                    <span style={{
                                                        display: 'inline-flex', width: 28, height: 28,
                                                        borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
                                                        background: rs.bg, color: rs.color, fontWeight: 800, fontSize: '0.8rem'
                                                    }}>{rank}</span>
                                                ) : (
                                                    <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{rank}</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex-row">
                                                    {m.avatar ? (
                                                        <img src={m.avatar} alt="" style={{
                                                            width: 32, height: 32, borderRadius: '50%'
                                                        }} onError={e => {
                                                            e.target.style.display = 'none'
                                                        }} />
                                                    ) : (
                                                        <div style={{
                                                            width: 32, height: 32, borderRadius: '50%',
                                                            background: `hsl(${(rank * 40) % 360}, 60%, 50%)`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.85rem', color: 'white', fontWeight: 700
                                                        }}>{(m.display_name || m.username || '?')[0]}</div>
                                                    )}
                                                    <div>
                                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.display_name || m.username}</span>
                                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}> @{m.username}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary-light)' }}>
                                                {m.total_points.toLocaleString()}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className="badge" style={{
                                                    background: m.rank_color ? `${m.rank_color}22` : undefined,
                                                    color: m.rank_color || undefined,
                                                    border: m.rank_color ? `1px solid ${m.rank_color}44` : undefined,
                                                }}>{m.rank_icon} {m.rank_label || '-'}</span>
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                                {(m.messages || 0).toLocaleString()}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                                {(m.reactions || 0).toLocaleString()}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                                {(m.voice_minutes || 0).toLocaleString()}分
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {(m.streak_days || 0) > 0 ? (
                                                    <span style={{ color: 'var(--accent-warning)' }}>🔥 {m.streak_days}日</span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Cards */}
                    <div className="stats-grid" style={{ marginTop: 'var(--spacing-xl)' }}>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'rgba(124, 92, 252, 0.15)' }}>⭐</div>
                            <div className="stat-value">{stats.totalPointsIssued.toLocaleString()}</div>
                            <div className="stat-label">総ポイント発行</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'rgba(0, 212, 170, 0.15)' }}>📊</div>
                            <div className="stat-value">{stats.averagePoints.toLocaleString()}</div>
                            <div className="stat-label">平均ポイント</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'rgba(255, 179, 71, 0.15)' }}>🔥</div>
                            <div className="stat-value">{stats.maxStreak}日</div>
                            <div className="stat-label">最長連続記録</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'rgba(77, 184, 255, 0.15)' }}>🎁</div>
                            <div className="stat-value">{stats.rewardsClaimed}</div>
                            <div className="stat-label">報酬交換数</div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
