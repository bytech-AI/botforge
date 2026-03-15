import { useState, useEffect, useContext } from 'react'
import { AppContext } from '../App'
import ChannelSelector from '../components/ChannelSelector'

const dayLabels = ['月', '火', '水', '木', '金', '土', '日']

/**
 * APIレスポンス（snake_case）をフロント用（camelCase）に変換する
 * @param {Object} row - APIから返されたスケジュールオブジェクト
 * @returns {Object} camelCase形式のスケジュールオブジェクト
 */
function deserialize(row) {
    return {
        id: row.id,
        guildId: row.guild_id,
        name: row.name,
        message: row.message,
        channelId: row.channel_id || '',
        time: row.time,
        days: row.days,
        timezone: row.timezone,
        enabled: row.enabled,
    }
}

export default function ScheduledMessages() {
    const { showToast, selectedGuild, guilds } = useContext(AppContext)
    const currentGuild = guilds.find(g => g.id === selectedGuild)
    const [schedules, setSchedules] = useState([])
    const [loading, setLoading] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({
        name: '', message: '', channelId: '', time: '12:00', days: [0, 1, 2, 3, 4, 5, 6], timezone: 'Asia/Tokyo', enabled: true
    })

    /**
     * selectedGuildが変わるたびにAPIからスケジュール一覧を取得する
     */
    useEffect(() => {
        if (!selectedGuild) return
        const fetchSchedules = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/scheduled-messages?guildId=${selectedGuild}`)
                if (!res.ok) throw new Error('取得に失敗しました')
                const data = await res.json()
                setSchedules(data.map(deserialize))
            } catch (err) {
                showToast(err.message || 'スケジュールの取得に失敗しました', 'error')
            } finally {
                setLoading(false)
            }
        }
        fetchSchedules()
    }, [selectedGuild])

    const openNew = () => {
        setForm({ name: '', message: '', channelId: '', time: '12:00', days: [0, 1, 2, 3, 4, 5, 6], timezone: 'Asia/Tokyo', enabled: true })
        setEditing(null)
        setShowModal(true)
    }

    const openEdit = (item) => {
        setForm({ ...item })
        setEditing(item.id)
        setShowModal(true)
    }

    /**
     * 新規作成はPOST、編集はPUTでAPIに保存する
     */
    const handleSave = async () => {
        if (!form.name.trim() || !form.message.trim()) {
            showToast('名前とメッセージを入力してください', 'error')
            return
        }
        try {
            if (editing) {
                // 編集: PUT /api/scheduled-messages/:id
                const res = await fetch(`/api/scheduled-messages/${editing}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: form.name,
                        message: form.message,
                        channelId: form.channelId,
                        time: form.time,
                        days: form.days,
                        timezone: form.timezone,
                        enabled: form.enabled,
                    }),
                })
                if (!res.ok) throw new Error('更新に失敗しました')
                setSchedules(schedules.map(s => s.id === editing ? { ...form, id: editing } : s))
                showToast('スケジュールを更新しました')
            } else {
                // 新規: POST /api/scheduled-messages
                const res = await fetch('/api/scheduled-messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        guildId: selectedGuild,
                        name: form.name,
                        message: form.message,
                        channelId: form.channelId,
                        time: form.time,
                        days: form.days,
                        timezone: form.timezone,
                        enabled: form.enabled,
                    }),
                })
                if (!res.ok) throw new Error('追加に失敗しました')
                const created = await res.json()
                setSchedules([...schedules, deserialize(created)])
                showToast('スケジュールを追加しました')
            }
            setShowModal(false)
        } catch (err) {
            showToast(err.message || '保存に失敗しました', 'error')
        }
    }

    /**
     * DELETE /api/scheduled-messages/:id でスケジュールを削除する
     * @param {number} id - 削除対象のスケジュールID
     */
    const handleDelete = async (id) => {
        try {
            const res = await fetch(`/api/scheduled-messages/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('削除に失敗しました')
            setSchedules(schedules.filter(x => x.id !== id))
            showToast('削除しました')
        } catch (err) {
            showToast(err.message || '削除に失敗しました', 'error')
        }
    }

    /**
     * PUT /api/scheduled-messages/:id で enabled を切り替える
     * @param {Object} schedule - 対象のスケジュールオブジェクト
     */
    const handleToggle = async (schedule) => {
        const newEnabled = !schedule.enabled
        try {
            const res = await fetch(`/api/scheduled-messages/${schedule.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: schedule.name,
                    message: schedule.message,
                    channelId: schedule.channelId,
                    time: schedule.time,
                    days: schedule.days,
                    timezone: schedule.timezone,
                    enabled: newEnabled,
                }),
            })
            if (!res.ok) throw new Error('切り替えに失敗しました')
            setSchedules(schedules.map(x => x.id === schedule.id ? { ...x, enabled: newEnabled } : x))
        } catch (err) {
            showToast(err.message || '有効/無効の切り替えに失敗しました', 'error')
        }
    }

    const toggleDay = (dayIndex) => {
        if (form.days.includes(dayIndex)) {
            setForm({ ...form, days: form.days.filter(d => d !== dayIndex) })
        } else {
            setForm({ ...form, days: [...form.days, dayIndex].sort() })
        }
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>⏰ 定時メッセージ</h1>
                <p>決まった時間に自動でメッセージを送信するスケジュールを管理します</p>
            </div>

            <div className="flex-between mb-lg">
                <span className="badge badge-accent">{schedules.length} スケジュール</span>
                <button className="btn btn-primary" onClick={openNew}>＋ 新しいスケジュール</button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-secondary)' }}>
                    読み込み中...
                </div>
            ) : (
                <div className="feature-list" style={{ gap: 'var(--spacing-md)' }}>
                    {schedules.map((s) => (
                        <div key={s.id} className="card" style={{ padding: 'var(--spacing-md) var(--spacing-lg)', opacity: s.enabled ? 1 : 0.5 }}>
                            <div className="flex-between">
                                <div className="flex-row gap-md">
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                        background: 'rgba(255, 179, 71, 0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                                    }}>⏰</div>
                                    <div>
                                        <div className="flex-row" style={{ gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 600 }}>{s.name}</span>
                                            <span className="badge badge-warning">{s.time}</span>
                                        </div>
                                        <div className="flex-row" style={{ gap: '4px' }}>
                                            {dayLabels.map((day, i) => (
                                                <span key={i} style={{
                                                    width: 24, height: 24, borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.7rem', fontWeight: 600,
                                                    background: s.days.includes(i) ? 'var(--accent-primary)' : 'var(--bg-glass)',
                                                    color: s.days.includes(i) ? 'white' : 'var(--text-tertiary)',
                                                    border: s.days.includes(i) ? 'none' : '1px solid var(--border-color)'
                                                }}>{day}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-row gap-md">
                                    <label className="toggle">
                                        <input type="checkbox" checked={s.enabled}
                                            onChange={() => handleToggle(s)} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <button className="btn-icon" onClick={() => openEdit(s)}>✏️</button>
                                    <button className="btn-icon" onClick={() => handleDelete(s.id)} style={{ color: 'var(--accent-danger)' }}>🗑️</button>
                                </div>
                            </div>
                            <div style={{
                                marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm) var(--spacing-md)',
                                background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)',
                                fontSize: '0.85rem', color: 'var(--text-secondary)'
                            }}>
                                {s.message}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'スケジュールを編集' : '新しいスケジュール'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">スケジュール名</label>
                            <input className="form-input" placeholder="朝の挨拶..."
                                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">送信チャンネル</label>
                            <ChannelSelector
                                channels={currentGuild?.channels || []}
                                categories={currentGuild?.categories || []}
                                mode="dropdown"
                                selectedId={form.channelId}
                                onChangeSingle={id => setForm({ ...form, channelId: id })}
                                placeholder="チャンネルを選択..."
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">送信時間</label>
                            <input type="time" className="form-input" value={form.time}
                                onChange={e => setForm({ ...form, time: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">送信曜日</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {dayLabels.map((day, i) => (
                                    <button key={i}
                                        className={`btn btn-sm ${form.days.includes(i) ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ flex: 1, justifyContent: 'center', padding: '8px 0' }}
                                        onClick={() => toggleDay(i)}
                                    >{day}</button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">メッセージ</label>
                            <textarea className="form-input form-textarea" placeholder="送信するメッセージ..."
                                value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
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
