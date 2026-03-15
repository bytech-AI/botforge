import { useState, useEffect, useContext } from 'react'
import { AppContext } from '../App'
import ChannelSelector from '../components/ChannelSelector'

export default function WelcomeMessages() {
    const { showToast, selectedGuild, guilds } = useContext(AppContext)
    const currentGuild = guilds.find(g => g.id === selectedGuild)
    const [loading, setLoading] = useState(false)
    const [welcome, setWelcome] = useState({
        enabled: true,
        channelId: '',
        message: '🎉 ようこそ {user} さん！\n{server} へようこそ！ルールチャンネルをご確認ください。',
        embedEnabled: true,
        embedTitle: 'Welcome!',
        embedDescription: '{username} さんがサーバーに参加しました！\nメンバー数: {memberCount}人目 🎊',
        embedColor: '#7c5cfc',
        embedThumbnail: true,
        dmEnabled: false,
        dmMessage: '{server} へようこそ！楽しい時間を過ごしてください 🎉',
    })

    const [leave, setLeave] = useState({
        enabled: false,
        channelId: '',
        message: '👋 {username} さんがサーバーを去りました...',
    })

    /**
     * サーバー選択時にAPIから入退室メッセージ設定を取得する
     */
    useEffect(() => {
        if (!selectedGuild) return
        setLoading(true)
        fetch(`/api/welcome-settings?guildId=${selectedGuild}`)
            .then(res => {
                if (!res.ok) throw new Error('設定の取得に失敗しました')
                return res.json()
            })
            .then(data => {
                if (data.welcome) setWelcome(prev => ({ ...prev, ...data.welcome }))
                if (data.leave) setLeave(prev => ({ ...prev, ...data.leave }))
            })
            .catch(err => {
                console.error('入退室メッセージ設定の取得エラー:', err)
            })
            .finally(() => setLoading(false))
    }, [selectedGuild])

    /**
     * 入退室メッセージ設定をAPIに保存する
     * @param {'welcome' | 'leave'} type - 保存対象の種別
     */
    const handleSave = async (type) => {
        if (!selectedGuild) {
            showToast('サーバーを選択してください', 'error')
            return
        }
        try {
            const res = await fetch(`/api/welcome-settings?guildId=${selectedGuild}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ welcome, leave }),
            })
            if (!res.ok) throw new Error('保存に失敗しました')
            showToast(type === 'welcome' ? '参加メッセージを保存しました' : '退出メッセージを保存しました')
        } catch (err) {
            console.error('保存エラー:', err)
            showToast('保存に失敗しました', 'error')
        }
    }

    // サーバー未選択時の表示
    if (!selectedGuild) {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <h1>👋 入退室メッセージ</h1>
                    <p>メンバーの参加・退出時に自動で送信されるメッセージを設定します</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                        サーバーを選択してください
                    </p>
                </div>
            </div>
        )
    }

    const variables = [
        { var: '{user}', desc: 'メンション' },
        { var: '{username}', desc: 'ユーザー名' },
        { var: '{server}', desc: 'サーバー名' },
        { var: '{memberCount}', desc: 'メンバー数' },
    ]

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>👋 入退室メッセージ</h1>
                <p>メンバーの参加・退出時に自動で送信されるメッセージを設定します</p>
            </div>

            {loading && <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>読み込み中...</p>}

            <div className="grid-2" style={{ gap: 'var(--spacing-xl)' }}>
                {/* Welcome */}
                <div className="card">
                    <div className="card-header">
                        <h2>🎉 参加メッセージ</h2>
                        <label className="toggle">
                            <input type="checkbox" checked={welcome.enabled}
                                onChange={e => setWelcome({ ...welcome, enabled: e.target.checked })} />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <div className="form-group">
                        <label className="form-label">送信チャンネル</label>
                        <ChannelSelector
                            channels={currentGuild?.channels || []}
                            categories={currentGuild?.categories || []}
                            mode="dropdown"
                            selectedId={welcome.channelId}
                            onChangeSingle={id => setWelcome({ ...welcome, channelId: id })}
                            placeholder="チャンネルを選択..."
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">メッセージ</label>
                        <textarea className="form-input form-textarea"
                            value={welcome.message}
                            onChange={e => setWelcome({ ...welcome, message: e.target.value })} />
                    </div>

                    <hr className="section-divider" />

                    <div className="toggle-wrapper mb-md">
                        <div>
                            <h4 style={{ fontSize: '0.9rem' }}>🎨 Embedメッセージ</h4>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>リッチなウェルカムカードを表示</p>
                        </div>
                        <label className="toggle">
                            <input type="checkbox" checked={welcome.embedEnabled}
                                onChange={e => setWelcome({ ...welcome, embedEnabled: e.target.checked })} />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {welcome.embedEnabled && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Embedタイトル</label>
                                <input className="form-input" value={welcome.embedTitle}
                                    onChange={e => setWelcome({ ...welcome, embedTitle: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Embed説明</label>
                                <textarea className="form-input form-textarea" value={welcome.embedDescription}
                                    onChange={e => setWelcome({ ...welcome, embedDescription: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">カラー</label>
                                <div className="flex-row">
                                    <input type="color" value={welcome.embedColor}
                                        onChange={e => setWelcome({ ...welcome, embedColor: e.target.value })}
                                        style={{ width: 40, height: 36, borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                                    <input className="form-input" value={welcome.embedColor}
                                        onChange={e => setWelcome({ ...welcome, embedColor: e.target.value })} style={{ flex: 1 }} />
                                </div>
                            </div>

                            {/* Preview */}
                            <div style={{ marginTop: 'var(--spacing-md)' }}>
                                <label className="form-label">プレビュー</label>
                                <div className="embed-preview" style={{ borderColor: welcome.embedColor }}>
                                    <div className="embed-title">{welcome.embedTitle || 'Welcome!'}</div>
                                    <div className="embed-description">
                                        {(welcome.embedDescription || '').replace('{username}', 'ユーザー名').replace('{memberCount}', '100')}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <hr className="section-divider" />

                    <div className="toggle-wrapper mb-md">
                        <div>
                            <h4 style={{ fontSize: '0.9rem' }}>📩 DMメッセージ</h4>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>参加者にDMも送信</p>
                        </div>
                        <label className="toggle">
                            <input type="checkbox" checked={welcome.dmEnabled}
                                onChange={e => setWelcome({ ...welcome, dmEnabled: e.target.checked })} />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {welcome.dmEnabled && (
                        <div className="form-group">
                            <label className="form-label">DMメッセージ</label>
                            <textarea className="form-input form-textarea" value={welcome.dmMessage}
                                onChange={e => setWelcome({ ...welcome, dmMessage: e.target.value })} />
                        </div>
                    )}

                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--spacing-md)' }}
                        onClick={() => handleSave('welcome')}>
                        💾 保存
                    </button>
                </div>

                {/* Leave */}
                <div>
                    <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                        <div className="card-header">
                            <h2>👋 退出メッセージ</h2>
                            <label className="toggle">
                                <input type="checkbox" checked={leave.enabled}
                                    onChange={e => setLeave({ ...leave, enabled: e.target.checked })} />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        <div className="form-group">
                            <label className="form-label">送信チャンネル</label>
                            <ChannelSelector
                                channels={currentGuild?.channels || []}
                                categories={currentGuild?.categories || []}
                                mode="dropdown"
                                selectedId={leave.channelId}
                                onChangeSingle={id => setLeave({ ...leave, channelId: id })}
                                placeholder="チャンネルを選択..."
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">メッセージ</label>
                            <textarea className="form-input form-textarea" value={leave.message}
                                onChange={e => setLeave({ ...leave, message: e.target.value })} />
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => handleSave('leave')}>
                            💾 保存
                        </button>
                    </div>

                    {/* Variable Reference */}
                    <div className="card">
                        <div className="card-header">
                            <h3>📝 使用可能な変数</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {variables.map(v => (
                                <div key={v.var} className="flex-between" style={{ fontSize: '0.85rem' }}>
                                    <code style={{
                                        background: 'rgba(124, 92, 252, 0.1)', padding: '2px 8px',
                                        borderRadius: '4px', color: 'var(--accent-primary-light)',
                                        fontFamily: 'var(--font-mono)', fontSize: '0.8rem'
                                    }}>{v.var}</code>
                                    <span style={{ color: 'var(--text-secondary)' }}>{v.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
