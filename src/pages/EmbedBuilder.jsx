import { useState, useContext } from 'react'
import { AppContext } from '../App'

export default function EmbedBuilder() {
    const { showToast } = useContext(AppContext)
    const [embed, setEmbed] = useState({
        author: '',
        authorIcon: '',
        title: 'お知らせ',
        url: '',
        description: 'ここにお知らせの内容を入力してください。\n**太字**や*斜体*も使えます！',
        color: '#7c5cfc',
        thumbnail: '',
        image: '',
        footer: 'BotForge で作成',
        footerIcon: '',
        timestamp: true,
        fields: [
            { name: '📅 日時', value: '2024年1月20日 20:00〜', inline: true },
            { name: '📍 場所', value: 'ボイスチャンネル #1', inline: true },
        ]
    })

    const addField = () => {
        setEmbed({ ...embed, fields: [...embed.fields, { name: '', value: '', inline: false }] })
    }

    const updateField = (index, key, value) => {
        const fields = [...embed.fields]
        fields[index] = { ...fields[index], [key]: value }
        setEmbed({ ...embed, fields })
    }

    const removeField = (index) => {
        setEmbed({ ...embed, fields: embed.fields.filter((_, i) => i !== index) })
    }

    const copyJson = () => {
        const json = JSON.stringify(embed, null, 2)
        navigator.clipboard.writeText(json).then(() => {
            showToast('JSONをコピーしました')
        })
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>🎨 Embedビルダー</h1>
                <p>Discord Embed メッセージをビジュアルに作成・プレビューできます</p>
            </div>

            <div className="grid-2" style={{ gap: 'var(--spacing-xl)', alignItems: 'flex-start' }}>
                {/* Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="card">
                        <div className="card-header"><h2>📝 基本設定</h2></div>

                        <div className="form-group">
                            <label className="form-label">著者名</label>
                            <input className="form-input" placeholder="ボット名など..."
                                value={embed.author} onChange={e => setEmbed({ ...embed, author: e.target.value })} />
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">タイトル</label>
                                <input className="form-input" placeholder="お知らせ"
                                    value={embed.title} onChange={e => setEmbed({ ...embed, title: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">カラー</label>
                                <div className="flex-row">
                                    <input type="color" value={embed.color}
                                        onChange={e => setEmbed({ ...embed, color: e.target.value })}
                                        style={{ width: 40, height: 36, borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                                    <input className="form-input" value={embed.color}
                                        onChange={e => setEmbed({ ...embed, color: e.target.value })} style={{ flex: 1 }} />
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">説明</label>
                            <textarea className="form-input form-textarea" rows={4}
                                value={embed.description} onChange={e => setEmbed({ ...embed, description: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">サムネイルURL</label>
                            <input className="form-input" placeholder="https://example.com/image.png"
                                value={embed.thumbnail} onChange={e => setEmbed({ ...embed, thumbnail: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">画像URL</label>
                            <input className="form-input" placeholder="https://example.com/banner.png"
                                value={embed.image} onChange={e => setEmbed({ ...embed, image: e.target.value })} />
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">フッター</label>
                                <input className="form-input" value={embed.footer}
                                    onChange={e => setEmbed({ ...embed, footer: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">タイムスタンプ</label>
                                <div style={{ marginTop: '8px' }}>
                                    <label className="toggle">
                                        <input type="checkbox" checked={embed.timestamp}
                                            onChange={e => setEmbed({ ...embed, timestamp: e.target.checked })} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Fields */}
                    <div className="card">
                        <div className="card-header">
                            <h2>📋 フィールド</h2>
                            <button className="btn btn-primary btn-sm" onClick={addField}>＋ 追加</button>
                        </div>

                        {embed.fields.map((field, i) => (
                            <div key={i} style={{
                                padding: 'var(--spacing-md)',
                                background: 'var(--bg-glass)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--spacing-sm)',
                                border: '1px solid var(--border-color)'
                            }}>
                                <div className="flex-between" style={{ marginBottom: 'var(--spacing-sm)' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                        フィールド {i + 1}
                                    </span>
                                    <div className="flex-row">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            <input type="checkbox" checked={field.inline}
                                                onChange={e => updateField(i, 'inline', e.target.checked)} />
                                            インライン
                                        </label>
                                        <button className="btn-icon" style={{ width: 28, height: 28 }}
                                            onClick={() => removeField(i)}>✕</button>
                                    </div>
                                </div>
                                <div className="grid-2">
                                    <input className="form-input" placeholder="フィールド名"
                                        value={field.name} onChange={e => updateField(i, 'name', e.target.value)}
                                        style={{ fontSize: '0.85rem' }} />
                                    <input className="form-input" placeholder="値"
                                        value={field.value} onChange={e => updateField(i, 'value', e.target.value)}
                                        style={{ fontSize: '0.85rem' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Preview */}
                <div style={{ position: 'sticky', top: 'var(--spacing-xl)' }}>
                    <div className="card">
                        <div className="card-header">
                            <h2>👁 プレビュー</h2>
                            <button className="btn btn-secondary btn-sm" onClick={copyJson}>📋 JSON</button>
                        </div>

                        {/* Discord-like preview */}
                        <div style={{
                            background: '#36393f', padding: 'var(--spacing-md)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: 'var(--accent-primary)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center'
                                }}>🤖</div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>BotForge Bot</span>
                                        <span className="badge badge-accent" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>BOT</span>
                                        <span style={{ fontSize: '0.72rem', color: '#72767d' }}>今日 20:00</span>
                                    </div>
                                </div>
                            </div>

                            <div className="embed-preview" style={{ borderColor: embed.color, marginLeft: '52px' }}>
                                {embed.author && (
                                    <div className="embed-author">
                                        {embed.author}
                                    </div>
                                )}
                                {embed.title && <div className="embed-title">{embed.title}</div>}
                                {embed.description && (
                                    <div className="embed-description" style={{ whiteSpace: 'pre-wrap' }}>
                                        {embed.description}
                                    </div>
                                )}

                                {embed.fields.length > 0 && (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: embed.fields.some(f => f.inline) ? 'repeat(3, 1fr)' : '1fr',
                                        gap: '8px', marginTop: '12px'
                                    }}>
                                        {embed.fields.map((field, i) => (
                                            <div key={i} className="embed-field"
                                                style={{ gridColumn: field.inline ? 'span 1' : '1 / -1' }}>
                                                <div className="embed-field-name">{field.name || '(名前)'}</div>
                                                <div className="embed-field-value">{field.value || '(値)'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {embed.image && (
                                    <div style={{
                                        marginTop: '12px', width: '100%', height: '150px',
                                        background: '#2f3136', borderRadius: '4px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#72767d', fontSize: '0.82rem'
                                    }}>🖼 画像プレビュー</div>
                                )}

                                {(embed.footer || embed.timestamp) && (
                                    <div className="embed-footer">
                                        {embed.footer}
                                        {embed.footer && embed.timestamp && ' • '}
                                        {embed.timestamp && new Date().toLocaleString('ja-JP')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'var(--spacing-md)' }}>
                        <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => showToast('Embedテンプレートを保存しました')}>
                            💾 テンプレートとして保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
