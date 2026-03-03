import { useState, useContext } from 'react'
import { AppContext } from '../App'

export default function AutoResponse() {
    const { showToast } = useContext(AppContext)
    const [responses, setResponses] = useState([
        { id: 1, trigger: 'おはよう', matchType: 'contains', response: 'おはようございます！☀️ 今日も素敵な一日を！', channel: 'all', enabled: true },
        { id: 2, trigger: 'gg', matchType: 'exact', response: 'ナイスゲーム！🎮', channel: 'all', enabled: true },
        { id: 3, trigger: '(https?://\\S+)', matchType: 'regex', response: '🔗 リンクが共有されました！', channel: 'specific', enabled: false },
    ])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({
        trigger: '', matchType: 'contains', response: '', channel: 'all', enabled: true
    })

    const matchTypeLabels = { contains: '部分一致', exact: '完全一致', regex: '正規表現', startsWith: '先頭一致' }

    const openNew = () => {
        setForm({ trigger: '', matchType: 'contains', response: '', channel: 'all', enabled: true })
        setEditing(null)
        setShowModal(true)
    }

    const openEdit = (item) => {
        setForm({ ...item })
        setEditing(item.id)
        setShowModal(true)
    }

    const handleSave = () => {
        if (!form.trigger.trim() || !form.response.trim()) {
            showToast('トリガーと応答を入力してください', 'error')
            return
        }
        if (editing) {
            setResponses(responses.map(r => r.id === editing ? { ...form, id: editing } : r))
            showToast('自動応答を更新しました')
        } else {
            setResponses([...responses, { ...form, id: Date.now() }])
            showToast('自動応答を追加しました')
        }
        setShowModal(false)
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>💬 自動応答</h1>
                <p>特定のキーワードやパターンに自動で応答する設定を管理します</p>
            </div>

            <div className="flex-between mb-lg">
                <span className="badge badge-accent">{responses.length} ルール</span>
                <button className="btn btn-primary" onClick={openNew}>＋ 新しい自動応答</button>
            </div>

            <div className="feature-list" style={{ gap: 'var(--spacing-md)' }}>
                {responses.map((r) => (
                    <div key={r.id} className="card" style={{
                        padding: 'var(--spacing-md) var(--spacing-lg)',
                        opacity: r.enabled ? 1 : 0.5
                    }}>
                        <div className="flex-between">
                            <div className="flex-row gap-md">
                                <div style={{
                                    width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                    background: 'rgba(0, 212, 170, 0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                                }}>💬</div>
                                <div>
                                    <div className="flex-row" style={{ gap: '8px', marginBottom: '4px' }}>
                                        <code style={{
                                            background: 'var(--bg-glass)', padding: '2px 8px',
                                            borderRadius: '4px', fontWeight: 600
                                        }}>{r.trigger}</code>
                                        <span className="badge badge-info">{matchTypeLabels[r.matchType]}</span>
                                    </div>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                        → {r.response}
                                    </p>
                                </div>
                            </div>
                            <div className="flex-row gap-md">
                                <label className="toggle">
                                    <input type="checkbox" checked={r.enabled}
                                        onChange={() => setResponses(responses.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x))} />
                                    <span className="toggle-slider"></span>
                                </label>
                                <button className="btn-icon" onClick={() => openEdit(r)}>✏️</button>
                                <button className="btn-icon" onClick={() => {
                                    setResponses(responses.filter(x => x.id !== r.id))
                                    showToast('削除しました')
                                }} style={{ color: 'var(--accent-danger)' }}>🗑️</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {responses.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">💬</div>
                    <h3>自動応答がまだありません</h3>
                    <p>キーワードに反応するボットの自動応答を設定しましょう</p>
                    <button className="btn btn-primary" onClick={openNew}>＋ 追加</button>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? '自動応答を編集' : '新しい自動応答'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">トリガー（キーワード）</label>
                            <input className="form-input" placeholder="反応するキーワード..."
                                value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">マッチタイプ</label>
                            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                {Object.entries(matchTypeLabels).map(([k, v]) => (
                                    <button key={k}
                                        className={`btn btn-sm ${form.matchType === k ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setForm({ ...form, matchType: k })}
                                    >{v}</button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">応答メッセージ</label>
                            <textarea className="form-input form-textarea" placeholder="応答内容..."
                                value={form.response} onChange={e => setForm({ ...form, response: e.target.value })} />
                        </div>

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
