import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../App'

const DEFAULT_PROMPT = `あなたはDiscordサーバーのメッセージ品質採点者です。
以下のメッセージを1〜10のスケールで採点してください。

採点基準:
- 会話への貢献度（質問、回答、議論への参加）
- 内容の質（情報量、有用性、具体性）
- コミュニティへの価値

低評価の対象:
- スパム、意味のない連投
- 単語のみの反応の繰り返し
- コピペ、無意味な文字列

必ず以下のJSON形式のみで回答してください:
{"score": <1-10の整数>, "reason": "<20文字以内の短い理由>"}`

const ANTHROPIC_MODELS = [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
]
const OPENAI_MODELS = [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
]

export default function AiScoring() {
    const { showToast, selectedGuild, botStatus, guilds } = useContext(AppContext)
    const currentGuild = guilds.find(g => g.id === selectedGuild)

    const [settings, setSettings] = useState({
        enabled: false,
        provider: 'anthropic',
        apiKeyEncrypted: '',
        model: 'claude-haiku-4-5-20251001',
        prompt: DEFAULT_PROMPT,
        channelMode: 'all',
        channels: [],
        minLength: 20,
        samplingRate: 100,
        bonusTiers: [
            { min_score: 7, rp: 3 },
            { min_score: 9, rp: 8 },
        ],
        lowQualityThreshold: 3,
        dailyApiLimit: 500,
        perUserDailyLimit: 30,
        notifyMode: 'none',
        logChannelId: '',
    })
    const [apiKeyInput, setApiKeyInput] = useState('')
    const [history, setHistory] = useState([])
    const [stats, setStats] = useState({ totalScored: 0, averageScore: 0, totalRpAwarded: 0, todayCount: 0 })
    const [activeTab, setActiveTab] = useState('basic')

    // データ取得
    useEffect(() => {
        if (!selectedGuild) return
        fetch(`/api/ai-scoring/settings?guildId=${selectedGuild}`)
            .then(r => r.json())
            .then(data => setSettings(prev => ({ ...prev, ...data })))
            .catch(() => { })
        fetch(`/api/ai-scoring/stats?guildId=${selectedGuild}`)
            .then(r => r.json())
            .then(setStats)
            .catch(() => { })
    }, [selectedGuild])

    // 履歴タブがアクティブになったら取得
    useEffect(() => {
        if (!selectedGuild || activeTab !== 'history') return
        fetch(`/api/ai-scoring/history?guildId=${selectedGuild}`)
            .then(r => r.json())
            .then(setHistory)
            .catch(() => { })
    }, [selectedGuild, activeTab])

    // サーバー未選択
    if (!selectedGuild) {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <h1>🤖 AI採点システム</h1>
                    <p>AIがメッセージの品質を自動採点し、スコアに応じてRPボーナスを付与します</p>
                </div>
                <div className="empty-state">
                    <div className="empty-icon">🔗</div>
                    <h3>サーバーを選択してください</h3>
                </div>
            </div>
        )
    }

    // 保存
    const saveSettings = async () => {
        try {
            const payload = { ...settings }
            delete payload.apiKeyEncrypted
            if (apiKeyInput) {
                payload.apiKey = apiKeyInput
            }
            const res = await fetch(`/api/ai-scoring/settings?guildId=${selectedGuild}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error((await res.json()).error || '保存に失敗しました')
            showToast('AI採点設定を保存しました')
            setApiKeyInput('')
        } catch (err) {
            showToast(err.message || '保存に失敗しました', 'error')
        }
    }

    // プロバイダ変更時にモデルをリセット
    const changeProvider = (provider) => {
        const defaultModel = provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini'
        setSettings({ ...settings, provider, model: defaultModel })
    }

    // ボーナスティア操作
    const addBonusTier = () => {
        setSettings({
            ...settings,
            bonusTiers: [...settings.bonusTiers, { min_score: 5, rp: 1 }],
        })
    }
    const removeBonusTier = (index) => {
        setSettings({
            ...settings,
            bonusTiers: settings.bonusTiers.filter((_, i) => i !== index),
        })
    }
    const updateBonusTier = (index, field, value) => {
        setSettings({
            ...settings,
            bonusTiers: settings.bonusTiers.map((t, i) =>
                i === index ? { ...t, [field]: parseInt(value) || 0 } : t
            ),
        })
    }

    // チャンネル選択トグル
    const toggleChannel = (channelId) => {
        const channels = settings.channels.includes(channelId)
            ? settings.channels.filter(id => id !== channelId)
            : [...settings.channels, channelId]
        setSettings({ ...settings, channels })
    }

    const models = settings.provider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>🤖 AI採点システム</h1>
                <p>AIがメッセージの品質を自動採点し、スコアに応じてRPボーナスを付与します</p>
            </div>

            <div className="tabs">
                {[
                    { id: 'basic', label: '⚙️ 基本設定' },
                    { id: 'target', label: '🎯 対象設定' },
                    { id: 'scoring', label: '📝 採点設定' },
                    { id: 'history', label: '📊 履歴・統計' },
                ].map(tab => (
                    <button key={tab.id}
                        className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >{tab.label}</button>
                ))}
            </div>

            {/* タブ1: 基本設定 */}
            {activeTab === 'basic' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.08) 0%, rgba(0, 212, 170, 0.04) 100%)',
                        borderColor: 'rgba(124, 92, 252, 0.15)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            🤖 AIプロバイダのAPIキーを設定し、メッセージの自動採点を有効化します。採点結果に応じてRPボーナスが付与されます。
                        </p>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>有効化</h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md)' }}>
                            <label className="toggle">
                                <input type="checkbox" checked={settings.enabled}
                                    onChange={e => setSettings({ ...settings, enabled: e.target.checked })} />
                                <span className="toggle-slider"></span>
                            </label>
                            <span style={{ color: settings.enabled ? 'var(--success)' : 'var(--text-muted)' }}>
                                {settings.enabled ? 'AI採点が有効' : 'AI採点が無効'}
                            </span>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>AIプロバイダ</h3>
                        </div>
                        <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div>
                                <label className="form-label">プロバイダ</label>
                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                    <button
                                        className={`btn ${settings.provider === 'anthropic' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => changeProvider('anthropic')}
                                    >Anthropic</button>
                                    <button
                                        className={`btn ${settings.provider === 'openai' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => changeProvider('openai')}
                                    >OpenAI</button>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">モデル</label>
                                <select className="form-input" value={settings.model}
                                    onChange={e => setSettings({ ...settings, model: e.target.value })}>
                                    {models.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="form-label">APIキー</label>
                                <input type="password" className="form-input"
                                    placeholder={settings.apiKeyEncrypted ? '設定済み' : 'sk-...'}
                                    value={apiKeyInput}
                                    onChange={e => setApiKeyInput(e.target.value)} />
                                {settings.apiKeyEncrypted && !apiKeyInput && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        APIキーは設定済みです。変更する場合のみ入力してください。
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>API制限</h3>
                        </div>
                        <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div className="grid-2">
                                <div>
                                    <label className="form-label">1日のAPI呼び出し上限</label>
                                    <input type="number" className="form-input" min="1" max="10000"
                                        value={settings.dailyApiLimit}
                                        onChange={e => setSettings({ ...settings, dailyApiLimit: parseInt(e.target.value) || 500 })} />
                                </div>
                                <div>
                                    <label className="form-label">ユーザーあたりの1日上限</label>
                                    <input type="number" className="form-input" min="1" max="1000"
                                        value={settings.perUserDailyLimit}
                                        onChange={e => setSettings({ ...settings, perUserDailyLimit: parseInt(e.target.value) || 30 })} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button className="btn btn-primary" onClick={saveSettings}
                        style={{ alignSelf: 'flex-start' }}>
                        保存
                    </button>
                </div>
            )}

            {/* タブ2: 対象設定 */}
            {activeTab === 'target' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.08) 0%, rgba(0, 212, 170, 0.04) 100%)',
                        borderColor: 'rgba(124, 92, 252, 0.15)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            🎯 採点対象のチャンネルやメッセージ条件を設定します。サンプリングレートで全メッセージの何%を採点するか調整できます。
                        </p>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>チャンネルモード</h3>
                        </div>
                        <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                {[
                                    { value: 'all', label: '全チャンネル' },
                                    { value: 'whitelist', label: 'ホワイトリスト' },
                                    { value: 'blacklist', label: 'ブラックリスト' },
                                ].map(mode => (
                                    <button key={mode.value}
                                        className={`btn ${settings.channelMode === mode.value ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setSettings({ ...settings, channelMode: mode.value })}
                                    >{mode.label}</button>
                                ))}
                            </div>

                            {settings.channelMode !== 'all' && (
                                <div>
                                    <label className="form-label">
                                        {settings.channelMode === 'whitelist' ? '採点するチャンネル' : '除外するチャンネル'}
                                    </label>
                                    <div style={{
                                        maxHeight: '200px', overflowY: 'auto',
                                        border: '1px solid var(--border)', borderRadius: '8px',
                                        padding: 'var(--spacing-sm)'
                                    }}>
                                        {currentGuild?.channels?.length > 0 ? (
                                            currentGuild.channels
                                                .map(ch => (
                                                    <label key={ch.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                                                        padding: '6px 8px', borderRadius: '4px', cursor: 'pointer'
                                                    }}>
                                                        <input type="checkbox"
                                                            checked={settings.channels.includes(ch.id)}
                                                            onChange={() => toggleChannel(ch.id)} />
                                                        <span style={{ color: 'var(--text-secondary)' }}>#</span>
                                                        <span>{ch.name}</span>
                                                    </label>
                                                ))
                                        ) : (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px' }}>
                                                チャンネル情報を取得できません
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>メッセージ条件</h3>
                        </div>
                        <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div>
                                <label className="form-label">最低文字数: {settings.minLength}文字</label>
                                <input type="range" min="5" max="200" value={settings.minLength}
                                    onChange={e => setSettings({ ...settings, minLength: parseInt(e.target.value) })}
                                    style={{ width: '100%' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <span>5文字</span>
                                    <span>200文字</span>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">サンプリングレート: {settings.samplingRate}%</label>
                                <input type="range" min="1" max="100" value={settings.samplingRate}
                                    onChange={e => setSettings({ ...settings, samplingRate: parseInt(e.target.value) })}
                                    style={{ width: '100%' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <span>1%</span>
                                    <span>100%</span>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    条件を満たすメッセージの{settings.samplingRate}%をランダムに採点します
                                </p>
                            </div>
                        </div>
                    </div>

                    <button className="btn btn-primary" onClick={saveSettings}
                        style={{ alignSelf: 'flex-start' }}>
                        保存
                    </button>
                </div>
            )}

            {/* タブ3: 採点設定 */}
            {activeTab === 'scoring' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.08) 0%, rgba(0, 212, 170, 0.04) 100%)',
                        borderColor: 'rgba(124, 92, 252, 0.15)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            📝 AIへのプロンプトとスコアに応じたRP付与ルールを設定します。
                        </p>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>採点プロンプト</h3>
                        </div>
                        <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                            <textarea className="form-input" rows={8}
                                style={{ fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                                value={settings.prompt}
                                onChange={e => setSettings({ ...settings, prompt: e.target.value })} />
                            <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}
                                onClick={() => setSettings({ ...settings, prompt: DEFAULT_PROMPT })}>
                                デフォルトに戻す
                            </button>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>ボーナスティア</h3>
                        </div>
                        <div style={{ padding: 'var(--spacing-md)' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                                スコアが指定値以上の場合に追加RPを付与します。
                            </p>
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ fontSize: '0.78rem' }}>最低スコア</th>
                                            <th style={{ fontSize: '0.78rem' }}>付与RP</th>
                                            <th style={{ width: '60px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {settings.bonusTiers.map((tier, i) => (
                                            <tr key={i}>
                                                <td>
                                                    <input type="number" className="form-input" min="1" max="10"
                                                        value={tier.min_score} style={{ width: '80px' }}
                                                        onChange={e => updateBonusTier(i, 'min_score', e.target.value)} />
                                                </td>
                                                <td>
                                                    <input type="number" className="form-input" min="0"
                                                        value={tier.rp} style={{ width: '80px' }}
                                                        onChange={e => updateBonusTier(i, 'rp', e.target.value)} />
                                                </td>
                                                <td>
                                                    <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                                        onClick={() => removeBonusTier(i)}>
                                                        削除
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button className="btn btn-secondary" style={{ marginTop: 'var(--spacing-sm)' }}
                                onClick={addBonusTier}>
                                + ティアを追加
                            </button>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>低品質しきい値</h3>
                        </div>
                        <div style={{ padding: 'var(--spacing-md)' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                                このスコア以下のメッセージは低品質と判定されます（RPペナルティなど将来の拡張用）。
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <input type="number" className="form-input" min="1" max="10"
                                    value={settings.lowQualityThreshold} style={{ width: '80px' }}
                                    onChange={e => setSettings({ ...settings, lowQualityThreshold: parseInt(e.target.value) || 3 })} />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>以下を低品質と判定</span>
                            </div>
                        </div>
                    </div>

                    <button className="btn btn-primary" onClick={saveSettings}
                        style={{ alignSelf: 'flex-start' }}>
                        保存
                    </button>
                </div>
            )}

            {/* タブ4: 履歴・統計 */}
            {activeTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        {[
                            { label: '総採点数', value: stats.totalScored, icon: '📊' },
                            { label: '平均スコア', value: stats.averageScore?.toFixed(1) || '0.0', icon: '⭐' },
                            { label: '付与RP合計', value: stats.totalRpAwarded, icon: '🏆' },
                            { label: '今日の採点数', value: stats.todayCount, icon: '📅' },
                        ].map((stat, i) => (
                            <div key={i} className="card" style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{stat.icon}</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {stat.value}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>採点履歴</h3>
                        </div>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ fontSize: '0.78rem' }}>日時</th>
                                        <th style={{ fontSize: '0.78rem' }}>ユーザー</th>
                                        <th style={{ fontSize: '0.78rem' }}>チャンネル</th>
                                        <th style={{ fontSize: '0.78rem' }}>メッセージ</th>
                                        <th style={{ fontSize: '0.78rem' }}>スコア</th>
                                        <th style={{ fontSize: '0.78rem' }}>RP付与</th>
                                        <th style={{ fontSize: '0.78rem' }}>理由</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length > 0 ? (
                                        history.map((entry, i) => {
                                            const scoreColor = entry.score < 4 ? '#ed4245'
                                                : entry.score <= 6 ? '#fee75c'
                                                : '#57f287'
                                            return (
                                                <tr key={i}>
                                                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                        {new Date(entry.created_at).toLocaleString('ja-JP', {
                                                            month: 'numeric', day: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem' }}>{entry.username || entry.user_id}</td>
                                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        #{entry.channel_name || entry.channel_id}
                                                    </td>
                                                    <td style={{
                                                        fontSize: '0.8rem', maxWidth: '200px',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                    }}>
                                                        {entry.message_preview || ''}
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            display: 'inline-block', padding: '2px 10px',
                                                            borderRadius: '12px', fontWeight: 700,
                                                            fontSize: '0.85rem', color: '#fff',
                                                            background: scoreColor
                                                        }}>
                                                            {entry.score}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                                        {entry.rp_awarded > 0 ? `+${entry.rp_awarded}` : '-'}
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        {entry.reasoning || ''}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--text-muted)' }}>
                                                採点履歴はまだありません
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
