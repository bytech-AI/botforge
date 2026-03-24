import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../App'
import ChannelSelector from '../components/ChannelSelector'

export default function PointSystem() {
    const { showToast, selectedGuild, botStatus, guilds } = useContext(AppContext)

    const [rules, setRules] = useState([])
    const [economy, setEconomy] = useState({
        transfer_fee_percent: 5,
        min_transfer_amount: 10,
        daily_transfer_limit: 10000,
        daily_bonus_amount: 50,
        daily_bonus_streak_multiplier: 1.1,
        max_daily_bonus: 200,
        enabled: 1
    })
    const [actions, setActions] = useState([])

    const [channelMultipliers, setChannelMultipliers] = useState([])
    const currentGuild = guilds.find(g => g.id === selectedGuild)

    const [decay, setDecay] = useState({
        enabled: false,
        type: 'percentage',
        amount: 5,
        interval: 30,
        minPoints: 0,
    })

    const [expiry, setExpiry] = useState({
        enabled: false,
        days: 90,
    })

    const [bonusRules, setBonusRules] = useState([
        { id: 1, type: 'streak', label: 'デイリーログインボーナス', description: '連続ログインで追加ポイント', bonus: 5, enabled: true },
        { id: 2, type: 'milestone', label: 'マイルストーン', description: '100メッセージ達成で特別ボーナス', bonus: 50, enabled: true },
        { id: 3, type: 'event', label: 'イベントボーナス', description: '期間限定ポイント2倍', bonus: 0, enabled: false },
    ])

    const [activeTab, setActiveTab] = useState(() => {
        try { return localStorage.getItem('tab_pointSystem') || 'rules' } catch { return 'rules' }
    })

    useEffect(() => { try { localStorage.setItem('tab_pointSystem', activeTab) } catch {} }, [activeTab])

    // Fetch rules from API
    useEffect(() => {
        fetch('/api/points/rules').then(r => r.json()).then(setRules).catch(() => { })
        fetch('/api/points/actions').then(r => r.json()).then(setActions).catch(() => { })
    }, [])

    // Fetch economy settings, channel multipliers, decay settings when guild changes
    useEffect(() => {
        if (selectedGuild) {
            fetch(`/api/points/economy?guildId=${selectedGuild}`)
                .then(r => r.json())
                .then(setEconomy)
                .catch(() => { })
            fetch(`/api/points/channel-multipliers?guildId=${selectedGuild}`)
                .then(r => r.json())
                .then(data => setChannelMultipliers(data.map(m => ({
                    id: m.id, channelId: m.channel_id, channelName: m.channel_id, multiplier: m.multiplier
                }))))
                .catch(() => { })
            fetch(`/api/points/decay-settings?guildId=${selectedGuild}`)
                .then(r => r.json())
                .then(data => {
                    if (data.decay) setDecay(data.decay)
                    if (data.expiry) setExpiry(data.expiry)
                })
                .catch(() => { })
        }
    }, [selectedGuild])

    const updateRule = (id, field, value) => {
        setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r))
    }

    const saveRules = async () => {
        try {
            await fetch('/api/points/rules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rules)
            })
            showToast('ポイントルールを保存しました')
        } catch {
            showToast('保存に失敗しました', 'error')
        }
    }

    const saveEconomy = async () => {
        if (!selectedGuild) {
            showToast('サーバーを選択してください', 'error')
            return
        }
        try {
            await fetch(`/api/points/economy?guildId=${selectedGuild}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(economy)
            })
            showToast('経済設定を保存しました')
        } catch {
            showToast('保存に失敗しました', 'error')
        }
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>⭐ ポイントシステム</h1>
                <p>メンバーのアクティビティに基づいたポイント付与ルールを設定します</p>
            </div>

            <div className="tabs">
                {[
                    { id: 'rules', label: '⚡ 基本ルール' },
                    { id: 'economy', label: '💰 経済設定' },
                    { id: 'actions', label: '📋 アクション一覧' },
                    { id: 'channels', label: '📍 チャンネル倍率' },
                    { id: 'bonus', label: '🎯 ボーナス' },
                    { id: 'decay', label: '📉 減衰・有効期限' },
                    { id: 'admin', label: '🏦 管理者送金' },
                    { id: 'danger', label: '⚠️ リセット' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >{tab.label}</button>
                ))}
            </div>

            {/* Basic Rules Tab */}
            {activeTab === 'rules' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.08) 0%, rgba(0, 212, 170, 0.04) 100%)',
                        borderColor: 'rgba(124, 92, 252, 0.15)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            💡 各アクションごとに付与されるポイント数を設定します。クールダウン（秒間隔）、1日の回数上限、1日のポイント上限を組み合わせて制限できます。0 = 無制限。
                        </p>
                    </div>

                    {rules.map((rule) => (
                        <div key={rule.id} className="card" style={{
                            padding: 'var(--spacing-md) var(--spacing-lg)',
                            opacity: rule.enabled ? 1 : 0.5,
                            transition: 'all 0.3s ease'
                        }}>
                            <div className="flex-between">
                                <div className="flex-row gap-md">
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 'var(--radius-md)',
                                        background: 'rgba(255, 179, 71, 0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.4rem'
                                    }}>{rule.icon}</div>
                                    <div>
                                        <h4 style={{ fontSize: '0.95rem', marginBottom: '2px' }}>{rule.label}</h4>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                            {rule.action}
                                        </p>
                                    </div>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={rule.enabled}
                                        onChange={e => updateRule(rule.id, 'enabled', e.target.checked)} />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            {rule.enabled && (
                                <div className="grid-2" style={{ marginTop: 'var(--spacing-md)' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">ポイント数</label>
                                        <div className="flex-row">
                                            <input type="number" className="form-input" step="0.1" min="0"
                                                value={rule.points}
                                                onChange={e => updateRule(rule.id, 'points', parseFloat(e.target.value) || 0)}
                                                style={{ textAlign: 'center' }} />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>pt</span>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">クールダウン（秒）</label>
                                        <input type="number" className="form-input" min="0"
                                            value={rule.cooldown}
                                            onChange={e => updateRule(rule.id, 'cooldown', parseInt(e.target.value) || 0)}
                                            style={{ textAlign: 'center' }} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">1日の回数上限</label>
                                        <input type="number" className="form-input" min="0"
                                            value={rule.daily_cap_count || 0}
                                            onChange={e => updateRule(rule.id, 'daily_cap_count', parseInt(e.target.value) || 0)}
                                            placeholder="0 = 無制限"
                                            style={{ textAlign: 'center' }} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">1日のポイント上限</label>
                                        <div className="flex-row">
                                            <input type="number" className="form-input" step="0.1" min="0"
                                                value={rule.daily_cap_points || 0}
                                                onChange={e => updateRule(rule.id, 'daily_cap_points', parseFloat(e.target.value) || 0)}
                                                placeholder="0 = 無制限"
                                                style={{ textAlign: 'center' }} />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>pt</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={saveRules}>
                            💾 ルールを保存
                        </button>
                    </div>
                </div>
            )}

            {/* Economy Settings Tab */}
            {activeTab === 'economy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(255, 179, 71, 0.08) 0%, rgba(124, 92, 252, 0.04) 100%)',
                        borderColor: 'rgba(255, 179, 71, 0.15)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            💰 ポイントをお金のように扱うための経済設定です。手数料・上限・デイリーボーナスなどを管理して、健全な経済システムを構築しましょう。
                        </p>
                    </div>

                    {!selectedGuild && (
                        <div className="card" style={{
                            textAlign: 'center', padding: 'var(--spacing-xl)',
                            borderColor: 'rgba(255, 179, 71, 0.2)'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>🔗</div>
                            <p style={{ color: 'var(--text-secondary)' }}>サーバーを選択して経済設定を管理してください</p>
                        </div>
                    )}

                    {selectedGuild && (
                        <>
                            {/* Transfer Settings */}
                            <div className="card">
                                <div className="card-header">
                                    <h2>💸 送金・譲渡設定</h2>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">送金手数料（%）</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <input type="range" min="0" max="50" step="0.5" value={economy.transfer_fee_percent}
                                                onChange={e => setEconomy({ ...economy, transfer_fee_percent: parseFloat(e.target.value) })}
                                                style={{ flex: 1 }} />
                                            <span style={{ fontWeight: 700, minWidth: '50px', textAlign: 'right', color: 'var(--accent-warning)' }}>
                                                {economy.transfer_fee_percent}%
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            100pt送金時の手数料: {economy.transfer_fee_percent}pt、受取額: {100 - economy.transfer_fee_percent}pt
                                        </p>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">最低送金額（pt）</label>
                                        <input type="number" className="form-input" min="1"
                                            value={economy.min_transfer_amount}
                                            onChange={e => setEconomy({ ...economy, min_transfer_amount: parseFloat(e.target.value) || 1 })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">1日あたりの送金上限（pt）</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        <input type="range" min="100" max="100000" step="100" value={economy.daily_transfer_limit}
                                            onChange={e => setEconomy({ ...economy, daily_transfer_limit: parseFloat(e.target.value) })}
                                            style={{ flex: 1 }} />
                                        <span style={{ fontWeight: 700, minWidth: '80px', textAlign: 'right' }}>
                                            {economy.daily_transfer_limit.toLocaleString()} pt
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Daily Bonus Settings */}
                            <div className="card">
                                <div className="card-header">
                                    <h2>🎁 デイリーボーナス設定</h2>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">基本ボーナス額（pt）</label>
                                        <input type="number" className="form-input" min="1"
                                            value={economy.daily_bonus_amount}
                                            onChange={e => setEconomy({ ...economy, daily_bonus_amount: parseFloat(e.target.value) || 1 })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">連続ログイン倍率</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <input type="range" min="1" max="2" step="0.05" value={economy.daily_bonus_streak_multiplier}
                                                onChange={e => setEconomy({ ...economy, daily_bonus_streak_multiplier: parseFloat(e.target.value) })}
                                                style={{ flex: 1 }} />
                                            <span style={{ fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>
                                                ×{economy.daily_bonus_streak_multiplier}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            連続ログインで倍率が累乗されます（例: 3日目 = {economy.daily_bonus_amount} × {economy.daily_bonus_streak_multiplier}² = {Math.round(economy.daily_bonus_amount * Math.pow(economy.daily_bonus_streak_multiplier, 2) * 10) / 10}pt）
                                        </p>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">ボーナス上限額（pt）</label>
                                    <input type="number" className="form-input" min="1"
                                        value={economy.max_daily_bonus}
                                        onChange={e => setEconomy({ ...economy, max_daily_bonus: parseFloat(e.target.value) || 100 })} />
                                    <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                        連続ボーナスがこの値を超えないように制限します
                                    </p>
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="card" style={{
                                background: 'var(--bg-glass)',
                                borderColor: 'rgba(124, 92, 252, 0.12)'
                            }}>
                                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
                                    📊 デイリーボーナスシミュレーション
                                </h4>
                                <div style={{ display: 'flex', gap: 'var(--spacing-lg)', overflowX: 'auto', paddingBottom: '4px' }}>
                                    {[1, 2, 3, 5, 7, 10, 14, 30].map(day => {
                                        const amount = Math.min(
                                            economy.daily_bonus_amount * Math.pow(economy.daily_bonus_streak_multiplier, day - 1),
                                            economy.max_daily_bonus
                                        )
                                        return (
                                            <div key={day} style={{ textAlign: 'center', minWidth: '60px' }}>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                                                    {day}日目
                                                </div>
                                                <div style={{
                                                    fontWeight: 700, fontSize: '0.85rem',
                                                    color: amount >= economy.max_daily_bonus ? 'var(--accent-warning)' : 'var(--accent-primary-light)'
                                                }}>
                                                    {Math.round(amount * 10) / 10}pt
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Voice Anti-Abuse Settings */}
                            <div className="card">
                                <div className="card-header">
                                    <h2>🎤 ボイスポイント不正対策</h2>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">最低参加人数</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <input type="range" min="2" max="10" value={economy.voice_min_members || 2}
                                                onChange={e => setEconomy({ ...economy, voice_min_members: parseInt(e.target.value) })}
                                                style={{ flex: 1 }} />
                                            <span style={{ fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>
                                                {economy.voice_min_members || 2}人
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            ミュート解除済みのメンバーがこの人数以上いないとポイントが付与されません
                                        </p>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <div className="toggle-wrapper">
                                        <div>
                                            <h4 style={{ fontSize: '0.9rem' }}>💬 アクティビティ要件</h4>
                                            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                                テキストチャンネルでメッセージを送信していないとボイスポイントを付与しない
                                            </p>
                                        </div>
                                        <label className="toggle">
                                            <input type="checkbox" checked={!!economy.voice_require_activity}
                                                onChange={e => setEconomy({ ...economy, voice_require_activity: e.target.checked })} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                                {economy.voice_require_activity && (
                                    <div className="form-group">
                                        <label className="form-label">アクティビティタイムアウト（分）</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <input type="range" min="5" max="120" step="5" value={economy.voice_activity_timeout_minutes || 30}
                                                onChange={e => setEconomy({ ...economy, voice_activity_timeout_minutes: parseInt(e.target.value) })}
                                                style={{ flex: 1 }} />
                                            <span style={{ fontWeight: 700, minWidth: '50px', textAlign: 'right' }}>
                                                {economy.voice_activity_timeout_minutes || 30}分
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            最後のメッセージ送信からこの時間が経過すると「非アクティブ」と判定されます
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Voice Debug */}
                            <VoiceDebugPanel />

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary btn-lg" onClick={saveEconomy}>
                                    💾 経済設定を保存
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Actions List Tab */}
            {activeTab === 'actions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.08) 0%, rgba(77, 184, 255, 0.04) 100%)',
                        borderColor: 'rgba(0, 212, 170, 0.15)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            📋 メンバーがポイントを獲得できるアクションの一覧です。これらはDiscord上で <code style={{ background: 'var(--bg-glass)', padding: '1px 6px', borderRadius: '4px' }}>/actions</code> コマンドでも確認できます。
                        </p>
                    </div>

                    {/* Point earning actions */}
                    <div className="card">
                        <div className="card-header">
                            <h2>⚡ ポイント獲得アクション</h2>
                            <span className="badge badge-accent">{actions.length} アクション</span>
                        </div>
                        {actions.length === 0 ? (
                            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--spacing-lg)' }}>
                                有効なアクションがありません。「基本ルール」タブでアクションを有効にしてください。
                            </p>
                        ) : (
                            <div className="feature-list">
                                {actions.map((action, i) => (
                                    <div key={i} className="feature-item">
                                        <div className="feature-item-info">
                                            <div style={{
                                                width: 48, height: 48, borderRadius: 'var(--radius-md)',
                                                background: 'rgba(0, 212, 170, 0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.4rem', flexShrink: 0
                                            }}>{action.icon}</div>
                                            <div className="feature-item-text">
                                                <h4>{action.label}</h4>
                                                <p>{action.description}</p>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-primary-light)' }}>
                                                +{action.points} pt
                                            </div>
                                            {action.cooldown > 0 && (
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                    ⏱ {action.cooldown}秒間隔
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Point commands */}
                    <div className="card">
                        <div className="card-header">
                            <h2>🤖 ポイント関連コマンド</h2>
                        </div>
                        <div className="feature-list">
                            {[
                                { cmd: '/balance', desc: 'ポイント残高・ランク・レベルを確認', icon: '💰' },
                                { cmd: '/transfer @user 金額', desc: 'ポイントを他のユーザーに送金（手数料あり）', icon: '💸' },
                                { cmd: '/pay @user 金額', desc: 'ポイントを手数料なしで支払い', icon: '💳' },
                                { cmd: '/ranking', desc: 'サーバーのポイントランキングTOP10', icon: '🏆' },
                                { cmd: '/daily', desc: 'デイリーボーナスを受け取り（連続で増加）', icon: '🎁' },
                                { cmd: '/history', desc: '自分のポイント取引履歴を確認', icon: '📜' },
                                { cmd: '/actions', desc: 'ポイント獲得アクション一覧表示', icon: '📋' },
                            ].map((item, i) => (
                                <div key={i} className="feature-item">
                                    <div className="feature-item-info">
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 'var(--radius-md)',
                                            background: 'rgba(124, 92, 252, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.2rem', flexShrink: 0
                                        }}>{item.icon}</div>
                                        <div className="feature-item-text">
                                            <h4>
                                                <code style={{
                                                    background: 'var(--bg-glass)', padding: '2px 8px',
                                                    borderRadius: '4px', fontWeight: 600
                                                }}>{item.cmd}</code>
                                            </h4>
                                            <p>{item.desc}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Channel Multipliers Tab */}
            {activeTab === 'channels' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.08) 0%, rgba(77, 184, 255, 0.04) 100%)',
                        borderColor: 'rgba(0, 212, 170, 0.15)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            📍 チャンネルごとにポイント倍率を設定できます。0にするとそのチャンネルではポイントが付与されません。
                        </p>
                    </div>

                    {!currentGuild ? (
                        <div className="card" style={{
                            textAlign: 'center', padding: 'var(--spacing-xl)',
                            borderColor: 'rgba(255, 179, 71, 0.2)'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>🔗</div>
                            <p style={{ color: 'var(--text-secondary)' }}>ボットを接続してサーバーを選択すると、チャンネル一覧が表示されます</p>
                        </div>
                    ) : (
                        <>
                            {channelMultipliers.map((cm) => (
                                <div key={cm.id} className="card" style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
                                    <div className="flex-between">
                                        <div className="flex-row gap-md">
                                            <div style={{
                                                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                                background: cm.multiplier > 1 ? 'rgba(74, 222, 128, 0.1)' : cm.multiplier === 0 ? 'rgba(255, 107, 107, 0.1)' : 'var(--bg-glass)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.2rem'
                                            }}>
                                                {cm.multiplier > 1 ? '🔥' : cm.multiplier === 0 ? '🚫' : '📍'}
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '0.9rem' }}># {cm.channelName}</h4>
                                                <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                                    {cm.multiplier === 0 ? 'ポイント無効' : cm.multiplier === 1 ? '通常' : `${cm.multiplier}倍ポイント`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex-row gap-md">
                                            <span style={{
                                                fontSize: '1.3rem', fontWeight: 800,
                                                color: cm.multiplier > 1 ? 'var(--accent-success)' : cm.multiplier === 0 ? 'var(--accent-danger)' : 'var(--text-secondary)'
                                            }}>×{cm.multiplier}</span>
                                            <input type="range" min="0" max="5" step="0.5" value={cm.multiplier}
                                                onChange={e => setChannelMultipliers(channelMultipliers.map(x =>
                                                    x.id === cm.id ? { ...x, multiplier: parseFloat(e.target.value) } : x
                                                ))}
                                                style={{ width: '120px' }} />
                                            <button className="btn-icon" onClick={() =>
                                                setChannelMultipliers(channelMultipliers.filter(x => x.id !== cm.id))
                                            } style={{ color: 'var(--accent-danger)' }}>✕</button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Add channel from real guild channels */}
                            {currentGuild.channels && currentGuild.channels.length > 0 && (() => {
                                const usedIds = channelMultipliers.map(cm => cm.channelId)
                                const available = currentGuild.channels.filter(c => !usedIds.includes(c.id))
                                if (available.length === 0) return (
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                        すべてのチャンネルが追加済みです
                                    </p>
                                )
                                return (
                                    <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">チャンネルを追加</label>
                                            <ChannelSelector
                                                channels={currentGuild.channels}
                                                categories={currentGuild.categories || []}
                                                mode="dropdown"
                                                selectedId=""
                                                onChangeSingle={id => {
                                                    const ch = currentGuild.channels.find(c => c.id === id)
                                                    if (ch) {
                                                        setChannelMultipliers([...channelMultipliers, {
                                                            id: Date.now(),
                                                            channelId: ch.id,
                                                            channelName: ch.name,
                                                            multiplier: 1
                                                        }])
                                                    }
                                                }}
                                                excludeIds={usedIds}
                                                placeholder="チャンネルを選択..."
                                            />
                                        </div>
                                    </div>
                                )
                            })()}

                            {channelMultipliers.length === 0 && (
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--text-tertiary)' }}>
                                    <p>チャンネル倍率が設定されていません</p>
                                    <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>上のドロップダウンからチャンネルを追加してください</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Bonus Tab */}
            {activeTab === 'bonus' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(255, 179, 71, 0.08) 0%, rgba(255, 107, 107, 0.04) 100%)',
                        borderColor: 'rgba(255, 179, 71, 0.15)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            🎯 特別なボーナスルールを設定して、エンゲージメントを高めましょう。
                        </p>
                    </div>

                    {bonusRules.map((bonus) => (
                        <div key={bonus.id} className="card" style={{
                            padding: 'var(--spacing-md) var(--spacing-lg)',
                            opacity: bonus.enabled ? 1 : 0.5
                        }}>
                            <div className="flex-between">
                                <div className="flex-row gap-md">
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 'var(--radius-md)',
                                        background: 'rgba(124, 92, 252, 0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.3rem'
                                    }}>
                                        {bonus.type === 'streak' ? '🔥' : bonus.type === 'milestone' ? '🏅' : '🎊'}
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '0.95rem', marginBottom: '2px' }}>{bonus.label}</h4>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{bonus.description}</p>
                                    </div>
                                </div>
                                <div className="flex-row gap-md">
                                    {bonus.bonus > 0 && (
                                        <span className="badge badge-warning">+{bonus.bonus}pt</span>
                                    )}
                                    <label className="toggle">
                                        <input type="checkbox" checked={bonus.enabled}
                                            onChange={() => setBonusRules(bonusRules.map(b =>
                                                b.id === bonus.id ? { ...b, enabled: !b.enabled } : b
                                            ))} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Decay & Expiry Tab */}
            {activeTab === 'decay' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <h2>📉 ポイント減衰</h2>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                    一定期間ごとにポイントを自動的に減少させます
                                </p>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" checked={decay.enabled}
                                    onChange={e => setDecay({ ...decay, enabled: e.target.checked })} />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {decay.enabled && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">減衰タイプ</label>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        <button
                                            className={`btn ${decay.type === 'percentage' ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{ flex: 1, justifyContent: 'center' }}
                                            onClick={() => setDecay({ ...decay, type: 'percentage' })}
                                        >パーセント減衰</button>
                                        <button
                                            className={`btn ${decay.type === 'fixed' ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{ flex: 1, justifyContent: 'center' }}
                                            onClick={() => setDecay({ ...decay, type: 'fixed' })}
                                        >固定値減衰</button>
                                    </div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">
                                            減衰量（{decay.type === 'percentage' ? '%' : 'pt'}）
                                        </label>
                                        <div className="number-input-group">
                                            <input type="range" min="1" max={decay.type === 'percentage' ? 50 : 100} value={decay.amount}
                                                onChange={e => setDecay({ ...decay, amount: parseInt(e.target.value) })} />
                                            <input type="number" value={decay.amount}
                                                onChange={e => setDecay({ ...decay, amount: parseInt(e.target.value) || 0 })} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">間隔（日）</label>
                                        <div className="number-input-group">
                                            <input type="range" min="1" max="90" value={decay.interval}
                                                onChange={e => setDecay({ ...decay, interval: parseInt(e.target.value) })} />
                                            <input type="number" value={decay.interval}
                                                onChange={e => setDecay({ ...decay, interval: parseInt(e.target.value) || 30 })} />
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">最小ポイント（これ以下にはならない）</label>
                                    <input type="number" className="form-input" min="0" value={decay.minPoints}
                                        onChange={e => setDecay({ ...decay, minPoints: parseInt(e.target.value) || 0 })} />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <div>
                                <h2>⏳ ポイント有効期限</h2>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                    獲得から一定期間後にポイントを失効させます
                                </p>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" checked={expiry.enabled}
                                    onChange={e => setExpiry({ ...expiry, enabled: e.target.checked })} />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {expiry.enabled && (
                            <div className="form-group">
                                <label className="form-label">有効期間（日）</label>
                                <div className="number-input-group">
                                    <input type="range" min="7" max="365" value={expiry.days}
                                        onChange={e => setExpiry({ ...expiry, days: parseInt(e.target.value) })} />
                                    <input type="number" value={expiry.days}
                                        onChange={e => setExpiry({ ...expiry, days: parseInt(e.target.value) || 90 })} />
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    獲得から{expiry.days}日後にポイントが失効します
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Admin Grant Tab */}
            {activeTab === 'admin' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                    <div className="card">
                        <div className="card-header">
                            <h2>🏦 管理者ポイント操作</h2>
                        </div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                            特定のメンバーにポイントを付与、または減額します。マイナス値を入力すると減額になります。
                        </p>

                        {!selectedGuild ? (
                            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--spacing-lg)' }}>
                                サーバーを選択してください
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">ユーザーID</label>
                                        <input type="text" className="form-input" id="admin-grant-user-id"
                                            placeholder="例: 123456789012345678" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">ポイント数</label>
                                        <div className="flex-row">
                                            <input type="number" className="form-input" id="admin-grant-amount"
                                                placeholder="例: 100（マイナスで減額）" step="1" />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>pt</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">理由（任意）</label>
                                    <input type="text" className="form-input" id="admin-grant-reason"
                                        placeholder="例: イベント報酬、手動補填など" />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-primary" onClick={async () => {
                                        const userId = document.getElementById('admin-grant-user-id').value.trim()
                                        const amount = parseFloat(document.getElementById('admin-grant-amount').value)
                                        const reason = document.getElementById('admin-grant-reason').value.trim()
                                        if (!userId) { showToast('ユーザーIDを入力してください', 'error'); return }
                                        if (!amount || isNaN(amount)) { showToast('ポイント数を入力してください', 'error'); return }
                                        const action = amount > 0 ? '付与' : '減額'
                                        if (!window.confirm(`ユーザー ${userId} に ${amount > 0 ? '+' : ''}${amount}pt ${action}しますか？`)) return
                                        try {
                                            const res = await fetch('/api/points/adjust', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ guildId: selectedGuild, userId, amount, reason: reason || `管理者による${action}` })
                                            })
                                            if (!res.ok) throw new Error((await res.json()).error || '操作に失敗しました')
                                            showToast(`${userId} に ${amount > 0 ? '+' : ''}${amount}pt ${action}しました`)
                                            document.getElementById('admin-grant-amount').value = ''
                                            document.getElementById('admin-grant-reason').value = ''
                                        } catch (err) { showToast(err.message || '操作に失敗しました', 'error') }
                                    }}>
                                        💸 ポイントを操作
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Danger Zone - Reset Tab */}
            {activeTab === 'danger' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(255, 71, 87, 0.08) 0%, rgba(255, 107, 107, 0.04) 100%)',
                        borderColor: 'rgba(255, 71, 87, 0.25)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--accent-danger)' }}>
                            ⚠️ この操作は取り消せません。実行前に必ず確認してください。
                        </p>
                    </div>

                    {!selectedGuild ? (
                        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                            <p style={{ color: 'var(--text-secondary)' }}>サーバーを選択してください</p>
                        </div>
                    ) : (
                        <>
                            <div className="card" style={{ borderColor: 'rgba(255, 71, 87, 0.2)' }}>
                                <div className="card-header">
                                    <div>
                                        <h2>🗑️ 全メンバーのポイントリセット</h2>
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                            サーバー内の全メンバーのポイントを0にリセットし、取引履歴を削除します
                                        </p>
                                    </div>
                                </div>
                                <button className="btn btn-danger" onClick={async () => {
                                    if (!window.confirm('本当にサーバー全体のポイントをリセットしますか？\nこの操作は取り消せません。')) return
                                    if (!window.confirm('最終確認: すべてのメンバーのポイントが0になります。よろしいですか？')) return
                                    try {
                                        const res = await fetch(`/api/points/reset?guildId=${selectedGuild}`, {
                                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({})
                                        })
                                        if (!res.ok) throw new Error()
                                        showToast('全メンバーのポイントをリセットしました')
                                    } catch { showToast('リセットに失敗しました', 'error') }
                                }}>
                                    全ポイントをリセット
                                </button>
                            </div>

                            <div className="card" style={{ borderColor: 'rgba(255, 71, 87, 0.2)' }}>
                                <div className="card-header">
                                    <div>
                                        <h2>👤 特定ユーザーのポイントリセット</h2>
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                            指定したユーザーのポイントのみをリセットします
                                        </p>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">ユーザーID</label>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        <input type="text" className="form-input" id="point-reset-user-id"
                                            placeholder="例: 123456789012345678" />
                                        <button className="btn btn-danger" onClick={async () => {
                                            const userId = document.getElementById('point-reset-user-id').value.trim()
                                            if (!userId) { showToast('ユーザーIDを入力してください', 'error'); return }
                                            if (!window.confirm(`ユーザー ${userId} のポイントをリセットしますか？`)) return
                                            try {
                                                const res = await fetch(`/api/points/reset?guildId=${selectedGuild}`, {
                                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ userId })
                                                })
                                                if (!res.ok) throw new Error()
                                                showToast('ユーザーのポイントをリセットしました')
                                            } catch { showToast('リセットに失敗しました', 'error') }
                                        }}>
                                            リセット
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab !== 'economy' && activeTab !== 'actions' && activeTab !== 'admin' && activeTab !== 'danger' && (
                <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary btn-lg"
                        onClick={async () => {
                            await saveRules()
                            if (selectedGuild) {
                                // チャンネル倍率保存
                                try {
                                    await fetch(`/api/points/channel-multipliers?guildId=${selectedGuild}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ multipliers: channelMultipliers })
                                    })
                                } catch { }
                                // 減衰・有効期限保存
                                try {
                                    await fetch(`/api/points/decay-settings?guildId=${selectedGuild}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ decay, expiry })
                                    })
                                } catch { }
                            }
                            showToast('ポイント設定を保存しました')
                        }}>
                        💾 すべての設定を保存
                    </button>
                </div>
            )}
        </div>
    )
}

/**
 * ボイスポイントのデバッグログパネル
 */
function VoiceDebugPanel() {
    const [debugEnabled, setDebugEnabled] = useState(false)
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetch('/api/voice-debug/status').then(r => r.json())
            .then(data => setDebugEnabled(data.enabled)).catch(() => {})
    }, [])

    const toggleDebug = async () => {
        const newState = !debugEnabled
        await fetch('/api/voice-debug/toggle', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: newState })
        })
        setDebugEnabled(newState)
        if (!newState) setLogs([])
    }

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const data = await fetch('/api/voice-debug/log').then(r => r.json())
            setLogs(data)
        } catch { }
        setLoading(false)
    }

    const clearLogs = async () => {
        await fetch('/api/voice-debug/clear', { method: 'POST' })
        setLogs([])
    }

    return (
        <div className="card" style={{ borderColor: debugEnabled ? 'rgba(255, 179, 71, 0.3)' : undefined }}>
            <div className="card-header">
                <h2>🔍 ボイスデバッグログ</h2>
                <label className="toggle">
                    <input type="checkbox" checked={debugEnabled} onChange={toggleDebug} />
                    <span className="toggle-slider"></span>
                </label>
            </div>
            {debugEnabled && (
                <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                        ONにすると毎分のボイスチャンネル判定結果を記録します。テスト後はOFFにしてください。
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        <button className="btn btn-primary btn-sm" onClick={fetchLogs} disabled={loading}>
                            {loading ? '取得中...' : 'ログを取得'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={clearLogs}>クリア</button>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                            {logs.length}件
                        </span>
                    </div>
                    {logs.length > 0 && (
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {logs.slice().reverse().map((entry, i) => (
                                <div key={i} style={{
                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                    marginBottom: '4px',
                                    background: entry.awarded ? 'rgba(74, 222, 128, 0.06)' : 'rgba(255, 107, 107, 0.06)',
                                    border: `1px solid ${entry.awarded ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 107, 107, 0.15)'}`,
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.82rem',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: 600 }}>#{entry.channel}</span>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                                            {new Date(entry.timestamp).toLocaleTimeString('ja-JP')}
                                        </span>
                                    </div>
                                    <div style={{ marginBottom: '4px', color: 'var(--text-secondary)' }}>
                                        全{entry.total}人 / 対象{entry.eligible}人 (最低{entry.minRequired}人必要)
                                        {entry.awarded
                                            ? <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}> → ポイント付与</span>
                                            : <span style={{ color: 'var(--accent-danger)', fontWeight: 600 }}> → 条件未達</span>
                                        }
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {entry.members.map((m, j) => (
                                            <span key={j} style={{
                                                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                                fontSize: '0.75rem', fontWeight: 500,
                                                background: m.eligible ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                                                color: m.eligible ? 'var(--accent-success)' : 'var(--accent-danger)',
                                            }}>
                                                {m.username}
                                                {!m.eligible && (
                                                    <span style={{ opacity: 0.7 }}>
                                                        ({[m.selfMute && 'ミュート', m.selfDeaf && 'デフ', m.serverMute && 'サバミュ', m.serverDeaf && 'サバデフ'].filter(Boolean).join(',')})
                                                    </span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
