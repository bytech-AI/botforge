import { useState, useContext } from 'react'
import { AppContext } from '../App'

const dayLabels = ['月', '火', '水', '木', '金', '土', '日']

export default function ScheduledMessages() {
    const { showToast } = useContext(AppContext)
    const [schedules, setSchedules] = useState([
        { id: 1, name: '朝の挨拶', message: '☀️ おはようございます！今日も一日頑張りましょう！', channelId: '', time: '08:00', days: [0, 1, 2, 3, 4], timezone: 'Asia/Tokyo', enabled: true },
        { id: 2, name: '週末イベント告知', message: '🎮 今週末のイベント情報はこちら！参加者募集中！', channelId: '', time: '18:00', days: [4], timezone: 'Asia/Tokyo', enabled: true },
    ])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({
        name: '', message: '', channelId: '', time: '12:00', days: [0, 1, 2, 3, 4, 5, 6], timezone: 'Asia/Tokyo', enabled: true
    })

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

    const handleSave = () => {
        if (!form.name.trim() || !form.message.trim()) {
            showToast('名前とメッセージを入力してください', 'error')
            return
        }
        if (editing) {
            setSchedules(schedules.map(s => s.id === editing ? { ...form, id: editing } : s))
            showToast('スケジュールを更新しました')
        } else {
            setSchedules([...schedules, { ...form, id: Date.now() }])
            showToast('スケジュールを追加しました')
        }
        setShowModal(false)
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
                                        onChange={() => setSchedules(schedules.map(x => x.id === s.id ? { ...x, enabled: !x.enabled } : x))} />
                                    <span className="toggle-slider"></span>
                                </label>
                                <button className="btn-icon" onClick={() => openEdit(s)}>✏️</button>
                                <button className="btn-icon" onClick={() => {
                                    setSchedules(schedules.filter(x => x.id !== s.id))
                                    showToast('削除しました')
                                }} style={{ color: 'var(--accent-danger)' }}>🗑️</button>
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
                            <label className="form-label">送信チャンネルID</label>
                            <input className="form-input" placeholder="チャンネルIDを入力..."
                                value={form.channelId} onChange={e => setForm({ ...form, channelId: e.target.value })} />
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
