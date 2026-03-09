import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../App'

export default function RankSystem() {
    const { showToast, selectedGuild, botStatus, guilds } = useContext(AppContext)
    const currentGuild = guilds.find(g => g.id === selectedGuild)
    const [activeTab, setActiveTab] = useState('config')

    // ランク設定
    const [ranks, setRanks] = useState([])
    // RPルール
    const [rpRules, setRpRules] = useState([])
    // 減衰設定
    const [decaySettings, setDecaySettings] = useState({ decay_rate: 0.02, decay_grace_days: 1, decay_floor: 0 })
    const [exemptMembers, setExemptMembers] = useState([])
    // シーズン
    const [seasonConfig, setSeasonConfig] = useState({ enabled: true, cycle_type: 'months', cycle_value: 3, start_date: '', bonus_distribution: { rank_bonuses: {}, top_bonuses: [] }, notify_channel_id: '' })
    const [nextSeasonEnd, setNextSeasonEnd] = useState('')
    const [seasonHistory, setSeasonHistory] = useState([])
    // リーダーボード
    const [leaderboard, setLeaderboard] = useState([])
    const [searchQuery, setSearchQuery] = useState('')

    // データ取得
    useEffect(() => {
        if (!selectedGuild) return
        fetch(`/api/ranks/config?guildId=${selectedGuild}`).then(r => r.json()).then(setRanks).catch(() => { })
        fetch(`/api/ranks/rp-rules?guildId=${selectedGuild}`).then(r => r.json()).then(setRpRules).catch(() => { })
        fetch(`/api/ranks/settings?guildId=${selectedGuild}`).then(r => r.json()).then(setDecaySettings).catch(() => { })
        fetch(`/api/ranks/exempt?guildId=${selectedGuild}`).then(r => r.json()).then(setExemptMembers).catch(() => { })
        fetch(`/api/ranks/season?guildId=${selectedGuild}`).then(r => r.json()).then(setSeasonConfig).catch(() => { })
        fetch(`/api/ranks/season/next?guildId=${selectedGuild}`).then(r => r.json()).then(d => setNextSeasonEnd(d.nextEnd || '')).catch(() => { })
        fetch(`/api/ranks/season/history?guildId=${selectedGuild}`).then(r => r.json()).then(setSeasonHistory).catch(() => { })
        fetch(`/api/ranks/leaderboard?guildId=${selectedGuild}&limit=50`).then(r => r.json()).then(setLeaderboard).catch(() => { })
    }, [selectedGuild])

    if (!selectedGuild) {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <h1>🏅 ランクシステム</h1>
                    <p>RP（ランクポイント）によるランク制を管理します</p>
                </div>
                <div className="empty-state">
                    <div className="empty-icon">🔗</div>
                    <h3>サーバーを選択してください</h3>
                </div>
            </div>
        )
    }

    // === 保存関数 ===
    const saveRankConfig = async () => {
        try {
            await fetch(`/api/ranks/config?guildId=${selectedGuild}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ranks })
            })
            showToast('ランク設定を保存しました')
        } catch { showToast('保存に失敗しました', 'error') }
    }

    const saveRpRules = async () => {
        try {
            await fetch(`/api/ranks/rp-rules?guildId=${selectedGuild}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: rpRules })
            })
            showToast('RPルールを保存しました')
        } catch { showToast('保存に失敗しました', 'error') }
    }

    const saveDecaySettings = async () => {
        try {
            await fetch(`/api/ranks/settings?guildId=${selectedGuild}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(decaySettings)
            })
            showToast('減衰設定を保存しました')
        } catch { showToast('保存に失敗しました', 'error') }
    }

    const saveSeasonConfig = async () => {
        try {
            await fetch(`/api/ranks/season?guildId=${selectedGuild}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(seasonConfig)
            })
            showToast('シーズン設定を保存しました')
        } catch { showToast('保存に失敗しました', 'error') }
    }

    // === 減衰シミュレーション ===
    const simDecay = (rp, days) => {
        let v = rp
        for (let i = 0; i < days; i++) v = Math.max(Math.floor(v * (1 - decaySettings.decay_rate)), decaySettings.decay_floor)
        return v
    }

    const filteredLb = leaderboard.filter(m =>
        (m.username || m.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    // ランク分布
    const rankDist = {}
    for (const r of ranks) rankDist[r.rank_key] = 0
    for (const m of leaderboard) {
        if (rankDist[m.current_rank_key] !== undefined) rankDist[m.current_rank_key]++
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>🏅 ランクシステム</h1>
                <p>RP（ランクポイント）によるランク制 — 活動するほどランクが上がり、CP倍率がアップ</p>
            </div>

            <div className="tabs">
                {[
                    { id: 'config', label: '⚙️ ランク設定' },
                    { id: 'rp-rules', label: '⚡ RPルール' },
                    { id: 'decay', label: '📉 減衰設定' },
                    { id: 'season', label: '🏆 シーズンボーナス' },
                    { id: 'leaderboard', label: '🏅 RPリーダーボード' },
                    { id: 'stats', label: '📊 分布 & 履歴' },
                ].map(tab => (
                    <button key={tab.id}
                        className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >{tab.label}</button>
                ))}
            </div>

            {/* タブ1: ランク設定 */}
            {activeTab === 'config' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.08) 0%, rgba(0, 212, 170, 0.04) 100%)',
                        borderColor: 'rgba(124, 92, 252, 0.15)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            ⚙️ 各ランクのRP閾値・CP倍率・アイコン・カラーを自由に設定できます。行の追加・削除も可能です。
                        </p>
                    </div>

                    <div className="card">
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>順序</th>
                                        <th>アイコン</th>
                                        <th>キー</th>
                                        <th>ラベル</th>
                                        <th>RP閾値</th>
                                        <th>CP倍率</th>
                                        <th>カラー</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ranks.map((r, i) => (
                                        <tr key={r.rank_key}>
                                            <td>{r.rank_order}</td>
                                            <td>
                                                <input className="form-input" value={r.icon} style={{ width: '50px', textAlign: 'center' }}
                                                    onChange={e => setRanks(ranks.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))} />
                                            </td>
                                            <td><code style={{ fontSize: '0.8rem' }}>{r.rank_key}</code></td>
                                            <td>
                                                <input className="form-input" value={r.rank_label} style={{ width: '70px' }}
                                                    onChange={e => setRanks(ranks.map((x, j) => j === i ? { ...x, rank_label: e.target.value } : x))} />
                                            </td>
                                            <td>
                                                <input type="number" className="form-input" value={r.rp_threshold} style={{ width: '90px' }}
                                                    onChange={e => setRanks(ranks.map((x, j) => j === i ? { ...x, rp_threshold: parseInt(e.target.value) || 0 } : x))} />
                                            </td>
                                            <td>
                                                <input type="number" className="form-input" value={r.cp_multiplier} step="0.1" min="0.1" max="5" style={{ width: '70px' }}
                                                    onChange={e => setRanks(ranks.map((x, j) => j === i ? { ...x, cp_multiplier: parseFloat(e.target.value) || 1 } : x))} />
                                            </td>
                                            <td>
                                                <input type="color" value={r.color} style={{ width: 32, height: 28, cursor: 'pointer', borderRadius: '4px' }}
                                                    onChange={e => setRanks(ranks.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} />
                                            </td>
                                            <td>
                                                <button className="btn-icon" style={{ color: 'var(--accent-danger)' }}
                                                    onClick={() => setRanks(ranks.filter((_, j) => j !== i))}>✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex-between" style={{ marginTop: 'var(--spacing-md)' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                                const order = ranks.length > 0 ? Math.max(...ranks.map(r => r.rank_order)) + 1 : 0
                                setRanks([...ranks, {
                                    rank_key: `new_${order}`, rank_label: '新ランク', rank_order: order,
                                    rp_threshold: 0, cp_multiplier: 1.0, color: '#808080', icon: '⭐'
                                }])
                            }}>＋ ランク追加</button>
                            <button className="btn btn-primary" onClick={saveRankConfig}>💾 保存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* タブ2: RPルール */}
            {activeTab === 'rp-rules' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.08) 0%, rgba(77, 184, 255, 0.04) 100%)',
                        borderColor: 'rgba(0, 212, 170, 0.15)'
                    }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            ⚡ 各アクションで獲得できるRP量を設定します。RPが貯まるとランクが上がり、CP倍率がアップします。
                        </p>
                    </div>

                    {rpRules.map((rule) => (
                        <div key={rule.id} className="card" style={{
                            padding: 'var(--spacing-md) var(--spacing-lg)',
                            opacity: rule.enabled ? 1 : 0.5
                        }}>
                            <div className="flex-between">
                                <div className="flex-row gap-md">
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 'var(--radius-md)',
                                        background: 'rgba(255, 179, 71, 0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem'
                                    }}>{rule.icon}</div>
                                    <div>
                                        <h4 style={{ fontSize: '0.95rem', marginBottom: '2px' }}>{rule.label}</h4>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{rule.action}</p>
                                    </div>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={rule.enabled}
                                        onChange={e => setRpRules(rpRules.map(r => r.id === rule.id ? { ...r, enabled: e.target.checked } : r))} />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                            {rule.enabled && (
                                <div className="grid-2" style={{ marginTop: 'var(--spacing-md)' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">RP量</label>
                                        <div className="flex-row">
                                            <input type="number" className="form-input" min="0" value={rule.rp_amount}
                                                onChange={e => setRpRules(rpRules.map(r => r.id === rule.id ? { ...r, rp_amount: parseInt(e.target.value) || 0 } : r))}
                                                style={{ textAlign: 'center' }} />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>RP</span>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">クールダウン（秒）</label>
                                        <input type="number" className="form-input" min="0" value={rule.cooldown}
                                            onChange={e => setRpRules(rpRules.map(r => r.id === rule.id ? { ...r, cooldown: parseInt(e.target.value) || 0 } : r))}
                                            style={{ textAlign: 'center' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={saveRpRules}>💾 RPルールを保存</button>
                    </div>
                </div>
            )}

            {/* タブ3: 減衰設定 */}
            {activeTab === 'decay' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                    <div className="card">
                        <div className="card-header">
                            <h2>📉 アクティブ減衰</h2>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                            活動した日はRPそのまま。サボった日だけRPが減衰します。
                        </p>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">減衰率（%）</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                    <input type="range" min="0.1" max="10" step="0.1" value={decaySettings.decay_rate * 100}
                                        onChange={e => setDecaySettings({ ...decaySettings, decay_rate: parseFloat(e.target.value) / 100 })}
                                        style={{ flex: 1 }} />
                                    <span style={{ fontWeight: 700, minWidth: '50px', textAlign: 'right' }}>
                                        {(decaySettings.decay_rate * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">猶予日数</label>
                                <div className="number-input-group">
                                    <input type="range" min="0" max="7" value={decaySettings.decay_grace_days}
                                        onChange={e => setDecaySettings({ ...decaySettings, decay_grace_days: parseInt(e.target.value) })} />
                                    <input type="number" value={decaySettings.decay_grace_days}
                                        onChange={e => setDecaySettings({ ...decaySettings, decay_grace_days: parseInt(e.target.value) || 0 })} />
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    {decaySettings.decay_grace_days}日連続で非アクティブになったら減衰開始
                                </p>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">RP下限</label>
                            <input type="number" className="form-input" min="0" value={decaySettings.decay_floor}
                                onChange={e => setDecaySettings({ ...decaySettings, decay_floor: parseInt(e.target.value) || 0 })}
                                style={{ width: '150px' }} />
                        </div>

                        {/* シミュレーション */}
                        <div style={{
                            marginTop: 'var(--spacing-md)', padding: 'var(--spacing-md)',
                            background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)'
                        }}>
                            <h4 style={{ fontSize: '0.88rem', marginBottom: 'var(--spacing-sm)' }}>📊 減衰シミュレーション（1000 RP の人が非アクティブの場合）</h4>
                            <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                                {[1, 3, 7, 14, 30].map(d => (
                                    <div key={d} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{d}日後</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-primary-light)' }}>
                                            {simDecay(1000, d)} RP
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                            <button className="btn btn-primary" onClick={saveDecaySettings}>💾 減衰設定を保存</button>
                        </div>
                    </div>

                    {/* 減衰免除メンバー */}
                    <div className="card">
                        <div className="card-header">
                            <h2>🛡️ 減衰免除メンバー</h2>
                            <span className="badge badge-accent">{exemptMembers.length} 人</span>
                        </div>
                        {exemptMembers.length === 0 ? (
                            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--spacing-md)' }}>
                                免除中のメンバーはいません
                            </p>
                        ) : (
                            <div className="feature-list">
                                {exemptMembers.map(m => (
                                    <div key={m.user_id} className="feature-item">
                                        <span>{m.user_id}</span>
                                        <button className="btn btn-secondary btn-sm" onClick={async () => {
                                            await fetch('/api/ranks/exempt', {
                                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ guildId: selectedGuild, userId: m.user_id, exempt: false })
                                            })
                                            setExemptMembers(exemptMembers.filter(x => x.user_id !== m.user_id))
                                            showToast('免除を解除しました')
                                        }}>免除解除</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* タブ4: シーズンボーナス */}
            {activeTab === 'season' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                    <div className="card">
                        <div className="card-header">
                            <h2>🏆 シーズンボーナス</h2>
                            <label className="toggle">
                                <input type="checkbox" checked={seasonConfig.enabled}
                                    onChange={e => setSeasonConfig({ ...seasonConfig, enabled: e.target.checked })} />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {seasonConfig.enabled && (
                            <>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">周期</label>
                                        <div className="flex-row gap-md">
                                            <input type="number" className="form-input" min="1" value={seasonConfig.cycle_value}
                                                onChange={e => setSeasonConfig({ ...seasonConfig, cycle_value: parseInt(e.target.value) || 1 })}
                                                style={{ width: '80px' }} />
                                            <select className="form-select" value={seasonConfig.cycle_type}
                                                onChange={e => setSeasonConfig({ ...seasonConfig, cycle_type: e.target.value })}>
                                                <option value="months">ヶ月ごと</option>
                                                <option value="days">日ごと</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">起算日</label>
                                        <input type="date" className="form-input" value={seasonConfig.start_date}
                                            onChange={e => setSeasonConfig({ ...seasonConfig, start_date: e.target.value })} />
                                    </div>
                                </div>

                                {nextSeasonEnd && (
                                    <div className="card" style={{
                                        background: 'rgba(243, 156, 18, 0.08)', borderColor: 'rgba(243, 156, 18, 0.2)',
                                        padding: 'var(--spacing-md)', textAlign: 'center'
                                    }}>
                                        <span style={{ fontSize: '0.85rem' }}>次のシーズン終了: <strong>{nextSeasonEnd}</strong></span>
                                    </div>
                                )}

                                {/* ランク別ボーナス */}
                                <div className="form-group" style={{ marginTop: 'var(--spacing-md)' }}>
                                    <label className="form-label">ランク別ボーナスRP</label>
                                    <div className="table-wrapper">
                                        <table>
                                            <thead>
                                                <tr><th>ランク</th><th>ボーナスRP</th></tr>
                                            </thead>
                                            <tbody>
                                                {ranks.map(r => (
                                                    <tr key={r.rank_key}>
                                                        <td>{r.icon} {r.rank_label}</td>
                                                        <td>
                                                            <input type="number" className="form-input" min="0"
                                                                style={{ width: '100px' }}
                                                                value={(seasonConfig.bonus_distribution?.rank_bonuses || {})[r.rank_key] || 0}
                                                                onChange={e => {
                                                                    const rb = { ...(seasonConfig.bonus_distribution?.rank_bonuses || {}) }
                                                                    rb[r.rank_key] = parseInt(e.target.value) || 0
                                                                    setSeasonConfig({
                                                                        ...seasonConfig,
                                                                        bonus_distribution: { ...seasonConfig.bonus_distribution, rank_bonuses: rb }
                                                                    })
                                                                }} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 通知チャンネル */}
                                {currentGuild && currentGuild.channels && (
                                    <div className="form-group">
                                        <label className="form-label">通知チャンネル</label>
                                        <select className="form-select" value={seasonConfig.notify_channel_id}
                                            onChange={e => setSeasonConfig({ ...seasonConfig, notify_channel_id: e.target.value })}>
                                            <option value="">通知なし</option>
                                            {currentGuild.channels.map(ch => (
                                                <option key={ch.id} value={ch.id}>#{ch.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex-between" style={{ marginTop: 'var(--spacing-md)' }}>
                                    <button className="btn btn-secondary" onClick={async () => {
                                        if (!confirm('テスト実行しますか？（本番のRPに影響します）')) return
                                        try {
                                            await fetch(`/api/ranks/season/execute?guildId=${selectedGuild}`, { method: 'POST' })
                                            showToast('シーズンボーナスを実行しました')
                                        } catch { showToast('実行に失敗しました', 'error') }
                                    }}>🧪 今すぐ実行（テスト）</button>
                                    <button className="btn btn-primary" onClick={saveSeasonConfig}>💾 シーズン設定を保存</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* タブ5: RPリーダーボード */}
            {activeTab === 'leaderboard' && (
                <div>
                    <div className="flex-between mb-lg">
                        <span className="badge badge-accent">{leaderboard.length} メンバー</span>
                        <input className="form-input" placeholder="🔍 メンバーを検索..."
                            style={{ width: '220px', padding: '8px 14px', fontSize: '0.85rem' }}
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>

                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>順位</th>
                                    <th>メンバー</th>
                                    <th style={{ textAlign: 'right' }}>ランク</th>
                                    <th style={{ textAlign: 'right' }}>RP</th>
                                    <th style={{ textAlign: 'right' }}>CP倍率</th>
                                    <th style={{ textAlign: 'right' }}>ポイント</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLb.map((m, i) => (
                                    <tr key={m.user_id}>
                                        <td><span style={{ fontWeight: 600 }}>{m.rank || i + 1}</span></td>
                                        <td>
                                            <div className="flex-row">
                                                {m.avatar ? (
                                                    <img src={m.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }}
                                                        onError={e => { e.target.style.display = 'none' }} />
                                                ) : null}
                                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.display_name || m.username || m.user_id}</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="badge" style={{
                                                background: m.color ? `${m.color}22` : undefined,
                                                color: m.color || undefined,
                                                border: m.color ? `1px solid ${m.color}44` : undefined,
                                            }}>{m.icon} {m.rank_label}</span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{(m.current_rp || 0).toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--accent-warning)' }}>×{m.cp_multiplier}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--accent-primary-light)' }}>
                                            {(m.total_points || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* タブ6: 分布 & 履歴 */}
            {activeTab === 'stats' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                    {/* ランク分布 */}
                    <div className="card">
                        <div className="card-header"><h2>📊 ランク分布</h2></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {ranks.map(r => {
                                const count = rankDist[r.rank_key] || 0
                                const maxCount = Math.max(1, ...Object.values(rankDist))
                                const pct = Math.round((count / maxCount) * 100)
                                return (
                                    <div key={r.rank_key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ width: '70px', fontSize: '0.85rem', fontWeight: 600 }}>{r.icon} {r.rank_label}</span>
                                        <div style={{ flex: 1, height: '24px', background: 'var(--bg-glass)', borderRadius: '12px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${pct}%`, height: '100%',
                                                background: r.color || 'var(--accent-primary)',
                                                borderRadius: '12px', transition: 'width 0.3s',
                                                minWidth: count > 0 ? '8px' : '0'
                                            }} />
                                        </div>
                                        <span style={{ width: '40px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>{count}人</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* シーズン履歴 */}
                    <div className="card">
                        <div className="card-header"><h2>📜 シーズン履歴</h2></div>
                        {seasonHistory.length === 0 ? (
                            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--spacing-md)' }}>
                                まだシーズン履歴がありません
                            </p>
                        ) : (
                            <div className="feature-list">
                                {seasonHistory.map(h => (
                                    <div key={h.id} className="card" style={{ padding: 'var(--spacing-md)' }}>
                                        <div className="flex-between" style={{ marginBottom: '8px' }}>
                                            <h4>シーズン {h.season_number}</h4>
                                            <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                                                {h.season_start} 〜 {h.season_end}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            参加者: {h.results.length}人 |
                                            TOP3: {h.results.slice(0, 3).map(r => `${r.username || r.user_id} (+${r.bonus_rp}RP)`).join(', ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
