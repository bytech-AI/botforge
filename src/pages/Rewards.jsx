import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../App'

const rewardTypes = [
    { value: 'role', label: 'ロール付与', icon: '👑', desc: 'Discordロールを自動付与' },
    { value: 'custom', label: 'カスタム報酬', icon: '🎁', desc: '運営が手動で対応' },
    { value: 'lottery', label: '抽選参加', icon: '🎰', desc: '抽選に参加する権利' },
    { value: 'external', label: '外部連携', icon: '🔗', desc: 'AIツール課金等の外部サービス' },
]

export default function Rewards() {
    const { showToast, selectedGuild, guilds } = useContext(AppContext)

    const [rewards, setRewards] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({
        name: '', type: 'role', icon: '🎁', cost: 100, roleId: '', description: '', stock: -1, enabled: true
    })
    const [activeTab, setActiveTab] = useState('list')
    const [exchangeHistory, setExchangeHistory] = useState([])

    const currentGuild = guilds.find(g => g.id === selectedGuild)

    // Fetch rewards from API
    useEffect(() => {
        fetch('/api/rewards').then(r => r.json()).then(setRewards).catch(() => { })
    }, [])

    // Fetch exchange history from API (reward-type transactions)
    useEffect(() => {
        if (selectedGuild) {
            fetch(`/api/points/transactions?guildId=${selectedGuild}&limit=20`)
                .then(r => r.json())
                .then(data => {
                    // Filter to reward transactions only
                    const rewardTx = data.filter(t => t.type === 'reward')
                    setExchangeHistory(rewardTx)
                })
                .catch(() => setExchangeHistory([]))
        }
    }, [selectedGuild])

    const openNew = () => {
        setForm({ name: '', type: 'role', icon: '🎁', cost: 100, roleId: '', description: '', stock: -1, enabled: true })
        setEditing(null)
        setShowModal(true)
    }

    const openEdit = (item) => {
        setForm({ ...item })
        setEditing(item.id)
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!form.name.trim()) {
            showToast('報酬名を入力してください', 'error')
            return
        }
        try {
            if (editing) {
                const res = await fetch(`/api/rewards/${editing}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                })
                if (!res.ok) throw new Error('保存に失敗しました')
                setRewards(rewards.map(r => r.id === editing ? { ...form, id: editing } : r))
                showToast('報酬を更新しました')
            } else {
                const res = await fetch('/api/rewards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                })
                if (!res.ok) throw new Error('追加に失敗しました')
                const newReward = await res.json()
                setRewards([...rewards, newReward])
                showToast('報酬を追加しました')
            }
        } catch {
            showToast('保存に失敗しました', 'error')
        }
        setShowModal(false)
    }

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`/api/rewards/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('削除に失敗しました')
            setRewards(rewards.filter(r => r.id !== id))
            showToast('報酬を削除しました')
        } catch {
            showToast('削除に失敗しました', 'error')
        }
    }

    const toggleEnabled = async (id) => {
        const updated = rewards.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
        const reward = updated.find(r => r.id === id)
        try {
            const res = await fetch(`/api/rewards/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reward)
            })
            if (!res.ok) throw new Error('更新に失敗しました')
            setRewards(updated)
        } catch {
            showToast('切り替えに失敗しました', 'error')
        }
    }

    const formatTime = (dateStr) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now - date
        const diffMin = Math.floor(diffMs / 60000)
        const diffHour = Math.floor(diffMs / 3600000)
        const diffDay = Math.floor(diffMs / 86400000)

        if (diffMin < 60) return `${diffMin}分前`
        if (diffHour < 24) return `${diffHour}時間前`
        return `${diffDay}日前`
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>🎁 報酬・還元</h1>
                <p>ポイントと交換できる報酬を設定します</p>
            </div>

            <div className="tabs">
                <button className={`tab ${activeTab === 'list' ? 'active' : ''}`}
                    onClick={() => setActiveTab('list')}>🎁 報酬一覧</button>
                <button className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}>📜 交換履歴</button>
                <button className={`tab ${activeTab === 'types' ? 'active' : ''}`}
                    onClick={() => setActiveTab('types')}>📋 報酬タイプ</button>
            </div>

            {activeTab === 'list' && (
                <>
                    <div className="flex-between mb-lg">
                        <span className="badge badge-accent">{rewards.length} 報酬</span>
                        <button className="btn btn-primary" onClick={openNew}>＋ 新しい報酬</button>
                    </div>

                    {rewards.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">🎁</div>
                            <h3>報酬がまだありません</h3>
                            <p>「新しい報酬」ボタンから最初の報酬を作成しましょう。ポイントと交換できるロールやアイテムを設定できます。</p>
                            <button className="btn btn-primary" onClick={openNew}>＋ 新しい報酬</button>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: 'var(--spacing-md)'
                        }}>
                            {rewards.map((reward) => (
                                <div key={reward.id} className="card" style={{
                                    opacity: reward.enabled ? 1 : 0.5,
                                    transition: 'all 0.3s ease',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                                        background: reward.type === 'role' ? 'var(--gradient-primary)'
                                            : reward.type === 'lottery' ? 'var(--gradient-warm)'
                                                : reward.type === 'external' ? 'var(--gradient-cool)'
                                                    : 'var(--gradient-accent)'
                                    }} />

                                    <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)' }}>
                                        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-sm)' }}>{reward.icon}</div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>{reward.name}</h3>
                                        <span className={`badge ${reward.type === 'role' ? 'badge-accent'
                                            : reward.type === 'lottery' ? 'badge-warning'
                                                : reward.type === 'external' ? 'badge-info'
                                                    : 'badge-online'
                                            }`}>
                                            {rewardTypes.find(t => t.value === reward.type)?.label}
                                        </span>
                                    </div>

                                    <p style={{
                                        fontSize: '0.85rem', color: 'var(--text-secondary)',
                                        textAlign: 'center', marginBottom: 'var(--spacing-md)'
                                    }}>
                                        {reward.description}
                                    </p>

                                    <div style={{
                                        display: 'flex', justifyContent: 'center', alignItems: 'baseline',
                                        gap: '4px', marginBottom: 'var(--spacing-md)'
                                    }}>
                                        <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary-light)' }}>
                                            {reward.cost.toLocaleString()}
                                        </span>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>pt</span>
                                    </div>

                                    <div className="flex-between" style={{
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        background: 'var(--bg-glass)',
                                        borderRadius: 'var(--radius-sm)',
                                        marginBottom: 'var(--spacing-md)'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>交換済み</div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{reward.claimed || 0}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>在庫</div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                                {reward.stock === -1 ? '∞' : Math.max(0, reward.stock - (reward.claimed || 0))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-row" style={{ gap: 'var(--spacing-sm)' }}>
                                        <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                                            onClick={() => openEdit(reward)}>
                                            ✏️ 編集
                                        </button>
                                        <button className="btn-icon" onClick={() => toggleEnabled(reward.id)}
                                            style={{
                                                color: reward.enabled ? 'var(--accent-success)' : 'var(--text-tertiary)',
                                                width: 36, height: 36
                                            }}>
                                            {reward.enabled ? '✅' : '⏸'}
                                        </button>
                                        <button className="btn-icon" onClick={() => handleDelete(reward.id)}
                                            style={{ color: 'var(--accent-danger)', width: 36, height: 36 }}>
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'history' && (
                <div className="card">
                    <div className="card-header">
                        <h2>📜 交換履歴</h2>
                    </div>
                    {exchangeHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-tertiary)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>📭</div>
                            <p>まだ交換履歴がありません</p>
                            <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                                メンバーが報酬と交換すると、ここに履歴が表示されます
                            </p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>日時</th>
                                        <th>メンバー</th>
                                        <th>内容</th>
                                        <th style={{ textAlign: 'right' }}>消費ポイント</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {exchangeHistory.map((h, i) => (
                                        <tr key={i}>
                                            <td style={{ color: 'var(--text-tertiary)' }}>{formatTime(h.created_at)}</td>
                                            <td style={{ fontWeight: 600 }}>{h.to_user_id}</td>
                                            <td>{h.description || '報酬交換'}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--accent-danger)', fontWeight: 600 }}>
                                                -{Math.abs(h.amount)} pt
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'types' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
                    {rewardTypes.map((type) => (
                        <div key={type.value} className="card" style={{
                            padding: 'var(--spacing-lg)',
                            background: 'var(--gradient-card)'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-md)' }}>{type.icon}</div>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 'var(--spacing-sm)' }}>
                                {type.label}
                            </h3>
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {type.desc}
                            </p>
                            {type.value === 'external' && (
                                <div style={{
                                    marginTop: 'var(--spacing-md)', padding: 'var(--spacing-sm) var(--spacing-md)',
                                    background: 'rgba(77, 184, 255, 0.05)',
                                    border: '1px solid rgba(77, 184, 255, 0.15)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.8rem', color: 'var(--accent-info)'
                                }}>
                                    💡 AIツール課金、サブスク等の外部サービスと連携可能（今後のアップデートで拡張予定）
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? '報酬を編集' : '新しい報酬'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">報酬名</label>
                                <input className="form-input" placeholder="VIPロール"
                                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">アイコン</label>
                                <input className="form-input" placeholder="🎁"
                                    value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                                    style={{ textAlign: 'center', fontSize: '1.3rem' }} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">報酬タイプ</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-xs)' }}>
                                {rewardTypes.map(rt => (
                                    <button key={rt.value}
                                        className={`btn btn-sm ${form.type === rt.value ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setForm({ ...form, type: rt.value })}
                                        style={{ justifyContent: 'center' }}
                                    >{rt.icon} {rt.label}</button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">説明</label>
                            <textarea className="form-input form-textarea" placeholder="報酬の説明..."
                                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">必要ポイント</label>
                                <input type="number" className="form-input" min="1"
                                    value={form.cost} onChange={e => setForm({ ...form, cost: parseInt(e.target.value) || 0 })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">在庫数（-1で無制限）</label>
                                <input type="number" className="form-input" min="-1"
                                    value={form.stock} onChange={e => setForm({ ...form, stock: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        {form.type === 'role' && (
                            <div className="form-group">
                                <label className="form-label">付与するロール</label>
                                {currentGuild && currentGuild.roles?.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                        {currentGuild.roles.map(role => (
                                            <button key={role.id}
                                                className={`btn btn-sm ${form.roleId === role.id ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => setForm({ ...form, roleId: role.id })}
                                                style={{ fontSize: '0.78rem' }}
                                            >
                                                <span style={{
                                                    width: 8, height: 8, borderRadius: '50%',
                                                    background: role.color !== '#000000' ? role.color : 'var(--text-tertiary)',
                                                    display: 'inline-block', marginRight: '4px'
                                                }} />
                                                {role.name}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <input className="form-input" placeholder="DiscordロールIDを入力..."
                                        value={form.roleId || ''} onChange={e => setForm({ ...form, roleId: e.target.value })} />
                                )}
                            </div>
                        )}

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>キャンセル</button>
                            <button className="btn btn-primary" onClick={handleSave}>
                                {editing ? '💾 保存' : '＋ 追加'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
