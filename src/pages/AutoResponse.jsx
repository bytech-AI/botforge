import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../App'

export default function AutoResponse() {
    const { showToast, selectedGuild } = useContext(AppContext)
    const [responses, setResponses] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({
        trigger: '', matchType: 'contains', response: '', channel: 'all', enabled: true
    })

    const matchTypeLabels = { contains: '部分一致', exact: '完全一致', regex: '正規表現', startsWith: '先頭一致' }

    // APIからデータ取得
    useEffect(() => {
        fetch(`/api/auto-responses?guildId=${selectedGuild || ''}`)
            .then(r => r.json())
            .then(data => setResponses(data.map(r => ({
                id: r.id, trigger: r.trigger_text, matchType: r.match_type,
                response: r.response, channel: r.channel_scope, enabled: r.enabled
            }))))
            .catch(() => { })
    }, [selectedGuild])

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

    const handleSave = async () => {
        if (!form.trigger.trim() || !form.response.trim()) {
            showToast('トリガーと応答を入力してください', 'error')
            return
        }
        try {
            if (editing) {
                const res = await fetch(`/api/auto-responses/${editing}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                })
                if (!res.ok) throw new Error('更新に失敗しました')
                setResponses(responses.map(r => r.id === editing ? { ...form, id: editing } : r))
                showToast('自動応答を更新しました')
            } else {
                const res = await fetch('/api/auto-responses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, guildId: selectedGuild })
                })
                if (!res.ok) throw new Error('追加に失敗しました')
                const created = await res.json()
                setResponses([...responses, {
                    id: created.id, trigger: created.trigger_text, matchType: created.match_type,
                    response: created.response, channel: created.channel_scope, enabled: !!created.enabled
                }])
                showToast('自動応答を追加しました')
            }
        } catch {
            showToast('保存に失敗しました', 'error')
        }
        setShowModal(false)
    }

    const handleToggle = async (r) => {
        const updated = { ...r, enabled: !r.enabled }
        try {
            const res = await fetch(`/api/auto-responses/${r.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            })
            if (!res.ok) throw new Error('更新に失敗しました')
            setResponses(responses.map(x => x.id === r.id ? updated : x))
        } catch {
            showToast('切り替えに失敗しました', 'error')
        }
    }

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`/api/auto-responses/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('削除に失敗しました')
            setResponses(responses.filter(x => x.id !== id))
            showToast('削除しました')
        } catch {
            showToast('削除に失敗しました', 'error')
        }
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
                                        onChange={() => handleToggle(r)} />
                                    <span className="toggle-slider"></span>
                                </label>
                                <button className="btn-icon" onClick={() => openEdit(r)}>✏️</button>
                                <button className="btn-icon" onClick={() => handleDelete(r.id)}
                                    style={{ color: 'var(--accent-danger)' }}>🗑️</button>
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
