import { useState, useContext } from 'react'
import { AppContext } from '../App'

export default function WelcomeMessages() {
    const { showToast } = useContext(AppContext)
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
                        <label className="form-label">送信チャンネルID</label>
                        <input className="form-input" placeholder="チャンネルIDを入力..."
                            value={welcome.channelId}
                            onChange={e => setWelcome({ ...welcome, channelId: e.target.value })} />
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
                        onClick={() => showToast('参加メッセージを保存しました')}>
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
                            <label className="form-label">送信チャンネルID</label>
                            <input className="form-input" placeholder="チャンネルIDを入力..."
                                value={leave.channelId}
                                onChange={e => setLeave({ ...leave, channelId: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">メッセージ</label>
                            <textarea className="form-input form-textarea" value={leave.message}
                                onChange={e => setLeave({ ...leave, message: e.target.value })} />
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => showToast('退出メッセージを保存しました')}>
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
