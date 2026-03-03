import { useState, useContext } from 'react'
import { AppContext } from '../App'

export default function BotSetup() {
    const { botStatus, setBotStatus, setBotName, showToast } = useContext(AppContext)
    const [token, setToken] = useState('')
    const [showToken, setShowToken] = useState(false)
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState(1)

    const steps = [
        { num: 1, title: 'トークン取得', desc: 'Discord Developer Portalでボットを作成' },
        { num: 2, title: 'トークン入力', desc: 'ボットのトークンを貼り付け' },
        { num: 3, title: '接続テスト', desc: 'ボットの接続を確認' },
    ]

    const handleConnect = async () => {
        if (!token.trim()) {
            showToast('トークンを入力してください', 'error')
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/bot/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            })
            const data = await res.json()
            if (data.success) {
                setBotStatus('online')
                setBotName(data.botName || 'MyBot')
                setStep(3)
                showToast('ボット接続成功！')
            } else {
                showToast(data.error || '接続に失敗しました', 'error')
            }
        } catch (err) {
            // Demo mode - simulate connection
            setBotStatus('online')
            setBotName('MyBot')
            setStep(3)
            showToast('ボット接続成功！（デモモード）')
        }
        setLoading(false)
    }

    const handleDisconnect = () => {
        setBotStatus('offline')
        setBotName('')
        setToken('')
        setStep(1)
        showToast('ボットを切断しました')
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>⚙️ ボット設定</h1>
                <p>Discord Botトークンを設定して、ボットを起動しましょう</p>
            </div>

            {/* Step Indicator */}
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                    {steps.map((s, i) => (
                        <div key={s.num} style={{
                            flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
                            opacity: s.num <= step ? 1 : 0.4
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: s.num <= step ? 'var(--accent-primary)' : 'var(--bg-glass)',
                                border: s.num <= step ? 'none' : '1px solid var(--border-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: '0.85rem',
                                color: s.num <= step ? 'white' : 'var(--text-tertiary)',
                                transition: 'all 0.3s ease',
                                flexShrink: 0
                            }}>
                                {s.num < step ? '✓' : s.num}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{s.desc}</div>
                            </div>
                            {i < steps.length - 1 && (
                                <div style={{
                                    flex: 1, height: 2, marginLeft: 'var(--spacing-md)',
                                    background: s.num < step ? 'var(--accent-primary)' : 'var(--border-color)',
                                    borderRadius: 1, transition: 'background 0.3s ease'
                                }} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid-2" style={{ gap: 'var(--spacing-xl)' }}>
                {/* Guide */}
                <div className="card">
                    <div className="card-header">
                        <h2>📖 セットアップガイド</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'var(--bg-glass)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h4 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--accent-primary-light)' }}>
                                ステップ 1: ボットを作成
                            </h4>
                            <ol style={{
                                paddingLeft: '20px', listStyleType: 'decimal',
                                color: 'var(--text-secondary)', fontSize: '0.88rem',
                                display: 'flex', flexDirection: 'column', gap: '6px'
                            }}>
                                <li><a href="https://discord.com/developers/applications" target="_blank" rel="noopener"
                                    style={{ color: 'var(--accent-info)', textDecoration: 'underline' }}>
                                    Discord Developer Portal</a> にアクセス</li>
                                <li>「New Application」をクリック</li>
                                <li>左メニューの「Bot」を選択</li>
                                <li>「Reset Token」でトークンを取得</li>
                            </ol>
                        </div>

                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'var(--bg-glass)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h4 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--accent-primary-light)' }}>
                                ステップ 2: 必要な権限
                            </h4>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 'var(--spacing-sm)' }}>
                                Bot設定ページで以下のIntentsを有効にしてください：
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {['PRESENCE INTENT', 'SERVER MEMBERS INTENT', 'MESSAGE CONTENT INTENT'].map(intent => (
                                    <div key={intent} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        fontSize: '0.82rem', color: 'var(--accent-success)'
                                    }}>
                                        <span>✓</span> {intent}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'rgba(255, 107, 107, 0.05)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(255, 107, 107, 0.15)'
                        }}>
                            <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-danger)', marginBottom: '4px' }}>
                                ⚠️ 注意
                            </h4>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                トークンは絶対に他の人と共有しないでください。このアプリ内でのみ使用されます。
                            </p>
                        </div>
                    </div>
                </div>

                {/* Token Input */}
                <div className="card">
                    <div className="card-header">
                        <h2>🔑 ボットトークン</h2>
                        {botStatus === 'online' && <span className="badge badge-online">● 接続中</span>}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Botトークン</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showToken ? 'text' : 'password'}
                                className="form-input"
                                placeholder="ここにBotトークンを貼り付け..."
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                style={{ paddingRight: '80px' }}
                            />
                            <button
                                onClick={() => setShowToken(!showToken)}
                                style={{
                                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                    padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
                                    fontSize: '0.75rem', color: 'var(--text-secondary)',
                                    cursor: 'pointer'
                                }}
                            >
                                {showToken ? '🙈 隠す' : '👁 表示'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        {botStatus === 'offline' ? (
                            <button className="btn btn-primary btn-lg" onClick={handleConnect} disabled={loading}
                                style={{ flex: 1, justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
                                {loading ? '⏳ 接続中...' : '🚀 ボットを接続'}
                            </button>
                        ) : (
                            <>
                                <button className="btn btn-success" style={{ flex: 1, justifyContent: 'center' }} disabled>
                                    ✅ 接続済み
                                </button>
                                <button className="btn btn-danger" onClick={handleDisconnect}>
                                    切断
                                </button>
                            </>
                        )}
                    </div>

                    {botStatus === 'online' && (
                        <div style={{
                            marginTop: 'var(--spacing-lg)',
                            padding: 'var(--spacing-md)',
                            background: 'rgba(74, 222, 128, 0.05)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(74, 222, 128, 0.15)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>🎉</span>
                                <h4>接続成功！</h4>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                ボットが正常に接続されました。サイドバーからコマンドの作成やポイントシステムの設定を行えます。
                            </p>
                        </div>
                    )}

                    {/* Invite URL Generator */}
                    <div style={{ marginTop: 'var(--spacing-lg)' }}>
                        <div className="card-header">
                            <h3>🔗 招待URL生成</h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                            ボットをサーバーに追加するための招待URLを生成します。
                        </p>
                        <div className="form-group">
                            <label className="form-label">クライアントID（Application ID）</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="クライアントIDを入力..."
                            />
                        </div>
                        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                            📋 招待URLをコピー
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
