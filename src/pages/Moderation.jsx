import { useState, useContext } from 'react'
import { AppContext } from '../App'

export default function Moderation() {
    const { showToast } = useContext(AppContext)
    const [settings, setSettings] = useState({
        ngWordEnabled: true,
        ngWords: ['badword1', 'badword2', 'spam'],
        action: 'delete_warn',
        spamEnabled: true,
        spamThreshold: 5,
        spamTimeWindow: 10,
        spamAction: 'mute',
        linkFilterEnabled: false,
        linkWhitelist: ['discord.gg', 'youtube.com', 'twitter.com'],
        capsFilterEnabled: false,
        capsThreshold: 70,
        logChannelId: '',
        warningLimit: 3,
        warningAction: 'kick',
    })
    const [newNgWord, setNewNgWord] = useState('')

    const actions = {
        delete: '削除のみ',
        delete_warn: '削除 + 警告',
        mute: 'ミュート',
        kick: 'キック',
        ban: 'BAN'
    }

    const addNgWord = () => {
        if (newNgWord.trim() && !settings.ngWords.includes(newNgWord.trim())) {
            setSettings({ ...settings, ngWords: [...settings.ngWords, newNgWord.trim()] })
            setNewNgWord('')
            showToast('NGワードを追加しました')
        }
    }

    const removeNgWord = (word) => {
        setSettings({ ...settings, ngWords: settings.ngWords.filter(w => w !== word) })
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>🛡️ モデレーション</h1>
                <p>サーバーの安全を守るための自動モデレーション設定です</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                {/* NG Word Filter */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h2>🚫 NGワードフィルター</h2>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                禁止ワードを含むメッセージを自動で検知します
                            </p>
                        </div>
                        <label className="toggle">
                            <input type="checkbox" checked={settings.ngWordEnabled}
                                onChange={e => setSettings({ ...settings, ngWordEnabled: e.target.checked })} />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {settings.ngWordEnabled && (
                        <>
                            <div className="form-group">
                                <label className="form-label">NGワード一覧</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--spacing-sm)' }}>
                                    {settings.ngWords.map(word => (
                                        <span key={word} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            padding: '4px 10px', background: 'rgba(255, 107, 107, 0.1)',
                                            border: '1px solid rgba(255, 107, 107, 0.2)',
                                            borderRadius: 'var(--radius-full)', fontSize: '0.82rem',
                                            color: 'var(--accent-danger)'
                                        }}>
                                            {word}
                                            <button onClick={() => removeNgWord(word)} style={{
                                                cursor: 'pointer', fontSize: '0.7rem', opacity: 0.7,
                                                color: 'var(--accent-danger)'
                                            }}>✕</button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex-row">
                                    <input className="form-input" placeholder="NGワードを追加..."
                                        value={newNgWord} onChange={e => setNewNgWord(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addNgWord()} style={{ flex: 1 }} />
                                    <button className="btn btn-primary btn-sm" onClick={addNgWord}>追加</button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">検知時のアクション</label>
                                <select className="form-select" value={settings.action}
                                    onChange={e => setSettings({ ...settings, action: e.target.value })}>
                                    {Object.entries(actions).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </div>

                {/* Spam Detection */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h2>🔄 スパム検知</h2>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                連続投稿やスパム行為を自動で検知
                            </p>
                        </div>
                        <label className="toggle">
                            <input type="checkbox" checked={settings.spamEnabled}
                                onChange={e => setSettings({ ...settings, spamEnabled: e.target.checked })} />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {settings.spamEnabled && (
                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">閾値（メッセージ数）</label>
                                <div className="number-input-group">
                                    <input type="range" min="3" max="20" value={settings.spamThreshold}
                                        onChange={e => setSettings({ ...settings, spamThreshold: parseInt(e.target.value) })} />
                                    <input type="number" value={settings.spamThreshold}
                                        onChange={e => setSettings({ ...settings, spamThreshold: parseInt(e.target.value) || 5 })} />
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    指定時間内にこの数を超えると検知
                                </p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">時間窓（秒）</label>
                                <div className="number-input-group">
                                    <input type="range" min="5" max="60" value={settings.spamTimeWindow}
                                        onChange={e => setSettings({ ...settings, spamTimeWindow: parseInt(e.target.value) })} />
                                    <input type="number" value={settings.spamTimeWindow}
                                        onChange={e => setSettings({ ...settings, spamTimeWindow: parseInt(e.target.value) || 10 })} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Link Filter */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h2>🔗 リンクフィルター</h2>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                許可リスト以外のリンクをブロック
                            </p>
                        </div>
                        <label className="toggle">
                            <input type="checkbox" checked={settings.linkFilterEnabled}
                                onChange={e => setSettings({ ...settings, linkFilterEnabled: e.target.checked })} />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {settings.linkFilterEnabled && (
                        <div className="form-group">
                            <label className="form-label">許可ドメイン</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {settings.linkWhitelist.map(domain => (
                                    <span key={domain} style={{
                                        padding: '4px 10px', background: 'rgba(74, 222, 128, 0.1)',
                                        border: '1px solid rgba(74, 222, 128, 0.2)',
                                        borderRadius: 'var(--radius-full)', fontSize: '0.82rem',
                                        color: 'var(--accent-success)'
                                    }}>
                                        {domain}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Warning System */}
                <div className="card">
                    <div className="card-header">
                        <h2>⚠️ 警告システム</h2>
                    </div>
                    <div className="grid-2">
                        <div className="form-group">
                            <label className="form-label">警告上限回数</label>
                            <div className="number-input-group">
                                <input type="range" min="1" max="10" value={settings.warningLimit}
                                    onChange={e => setSettings({ ...settings, warningLimit: parseInt(e.target.value) })} />
                                <input type="number" value={settings.warningLimit}
                                    onChange={e => setSettings({ ...settings, warningLimit: parseInt(e.target.value) || 3 })} />
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                この回数に達すると自動処分
                            </p>
                        </div>
                        <div className="form-group">
                            <label className="form-label">上限到達時のアクション</label>
                            <select className="form-select" value={settings.warningAction}
                                onChange={e => setSettings({ ...settings, warningAction: e.target.value })}>
                                <option value="mute">ミュート</option>
                                <option value="kick">キック</option>
                                <option value="ban">BAN</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Log Channel */}
                <div className="card">
                    <div className="card-header">
                        <h2>📋 ログチャンネル</h2>
                    </div>
                    <div className="form-group">
                        <label className="form-label">モデレーションログの送信先チャンネルID</label>
                        <input className="form-input" placeholder="チャンネルIDを入力..."
                            value={settings.logChannelId}
                            onChange={e => setSettings({ ...settings, logChannelId: e.target.value })} />
                    </div>
                </div>

                <button className="btn btn-primary btn-lg"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={() => showToast('モデレーション設定を保存しました')}>
                    💾 すべての設定を保存
                </button>
            </div>
        </div>
    )
}
