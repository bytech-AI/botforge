import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../App'

const responseTypes = [
    { value: 'text', label: 'テキスト応答', icon: '💬' },
    { value: 'embed', label: 'Embed応答', icon: '🎨' },
    { value: 'random', label: 'ランダム応答', icon: '🎲' },
]

const optionTypes = [
    { value: 'string', label: 'テキスト', icon: '📝' },
    { value: 'user', label: 'ユーザー', icon: '👤' },
    { value: 'integer', label: '整数', icon: '🔢' },
    { value: 'number', label: '数値', icon: '#️⃣' },
    { value: 'channel', label: 'チャンネル', icon: '📍' },
    { value: 'boolean', label: '真偽値', icon: '✅' },
    { value: 'role', label: 'ロール', icon: '👑' },
]

const permissionOptions = [
    { value: 'Administrator', label: '管理者' },
    { value: 'ManageGuild', label: 'サーバー管理' },
    { value: 'ManageMessages', label: 'メッセージ管理' },
    { value: 'ManageRoles', label: 'ロール管理' },
    { value: 'ManageChannels', label: 'チャンネル管理' },
    { value: 'KickMembers', label: 'メンバーをキック' },
    { value: 'BanMembers', label: 'メンバーをBAN' },
    { value: 'ModerateMembers', label: 'メンバーをモデレート' },
]

const defaultCommand = {
    name: '',
    description: '',
    responseType: 'text',
    responseText: '',
    embedTitle: '',
    embedDescription: '',
    embedColor: '#7c5cfc',
    ephemeral: false,
    cooldown: 0,
    enabled: true,
    options: [],
    requiredPermissions: [],
    allowedRoles: [],
    randomResponses: [''],
    dmResponse: false,
    isBuiltin: false,
    pointCost: 0,
    pointRewardMin: 0,
    pointRewardMax: 0,
}

const defaultOption = {
    name: '',
    description: '',
    type: 'string',
    required: false,
    choices: [],
}

export default function CommandBuilder() {
    const { showToast, botStatus, selectedGuild, guilds } = useContext(AppContext)
    const [commands, setCommands] = useState([])
    const [registeredCommands, setRegisteredCommands] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingCommand, setEditingCommand] = useState(null)
    const [form, setForm] = useState({ ...defaultCommand })
    const [syncing, setSyncing] = useState(false)
    const [activeTab, setActiveTab] = useState('basic')

    const currentGuild = guilds.find(g => g.id === selectedGuild)

    useEffect(() => {
        fetch('/api/commands').then(r => r.json()).then(setCommands).catch(() => { })
        if (botStatus === 'online') {
            fetch(`/api/commands/registered${selectedGuild ? `?guildId=${selectedGuild}` : ''}`)
                .then(r => r.json())
                .then(setRegisteredCommands)
                .catch(() => { })
        }
    }, [botStatus, selectedGuild])

    const variables = [
        { var: '{user}', desc: 'コマンド実行者のメンション' },
        { var: '{username}', desc: 'ユーザー名' },
        { var: '{server}', desc: 'サーバー名' },
        { var: '{memberCount}', desc: 'メンバー数' },
        { var: '{channelCount}', desc: 'チャンネル数' },
        { var: '{random:1-100}', desc: 'ランダム数値' },
        { var: '{date}', desc: '今日の日付' },
        { var: '{time}', desc: '現在の時刻' },
    ]

    // Add option variables dynamically
    const optionVars = (form.options || []).map(opt => ({
        var: `{option:${opt.name}}`,
        desc: `オプション「${opt.name}」の値`
    }))

    const allVariables = [...variables, ...optionVars]

    const openNew = () => {
        setForm({ ...defaultCommand, randomResponses: [''] })
        setEditingCommand(null)
        setActiveTab('basic')
        setShowModal(true)
    }

    const openEdit = (cmd) => {
        setForm({
            ...defaultCommand,
            ...cmd,
            options: cmd.options || [],
            requiredPermissions: cmd.requiredPermissions || [],
            allowedRoles: cmd.allowedRoles || [],
            randomResponses: cmd.randomResponses && cmd.randomResponses.length > 0 ? cmd.randomResponses : [''],
            pointCost: cmd.pointCost || 0,
            pointRewardMin: cmd.pointRewardMin || 0,
            pointRewardMax: cmd.pointRewardMax || 0,
        })
        setEditingCommand(cmd.id)
        setActiveTab('basic')
        setShowModal(true)
    }

    const importRegisteredCommand = async (regCmd) => {
        // Check if already in dashboard
        if (commands.find(c => c.name === regCmd.name)) {
            showToast(`/${regCmd.name} は既にダッシュボードに存在しています`, 'error')
            return
        }
        const newCmd = {
            ...defaultCommand,
            name: regCmd.name,
            description: regCmd.description || '',
            responseType: 'text',
            responseText: `{user} が /${regCmd.name} を実行しました`,
            enabled: true,
        }
        try {
            const res = await fetch('/api/commands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCmd)
            })
            const created = await res.json()
            if (!res.ok) throw new Error(created.error || '取り込みに失敗しました')
            setCommands([...commands, created])
            showToast(`/${regCmd.name} をダッシュボードに取り込みました`)
            // Open for editing
            openEdit(created)
        } catch {
            showToast('取り込みに失敗しました', 'error')
        }
    }

    const handleSave = async () => {
        if (!form.name.trim()) {
            showToast('コマンド名を入力してください', 'error')
            return
        }
        // Validate options
        const validOptions = (form.options || []).filter(o => o.name.trim())

        const formData = {
            ...form,
            options: validOptions,
            randomResponses: form.responseType === 'random' ? form.randomResponses.filter(r => r.trim()) : [],
        }

        try {
            if (editingCommand) {
                const res = await fetch(`/api/commands/${editingCommand}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || '更新に失敗しました')
                setCommands(commands.map(c => c.id === editingCommand ? { ...formData, id: editingCommand } : c))
                showToast('コマンドを更新しました')
            } else {
                const res = await fetch('/api/commands', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                })
                const newCmd = await res.json()
                if (!res.ok) throw new Error(newCmd.error || '追加に失敗しました')
                setCommands([...commands, newCmd])
                showToast('コマンドを追加しました')
            }
        } catch (err) {
            showToast(err.message || 'コマンドの保存に失敗しました', 'error')
            return
        }
        setShowModal(false)
    }

    const handleDelete = async (id) => {
        try {
            await fetch(`/api/commands/${id}`, { method: 'DELETE' })
        } catch { }
        setCommands(commands.filter(c => c.id !== id))
        showToast('コマンドを削除しました')
    }

    const toggleEnabled = (id) => {
        const updated = commands.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
        setCommands(updated)
        const cmd = updated.find(c => c.id === id)
        fetch(`/api/commands/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cmd)
        }).catch(() => { })
    }

    const syncToDiscord = async () => {
        if (botStatus !== 'online') {
            showToast('ボットが接続されていません', 'error')
            return
        }
        setSyncing(true)
        try {
            const res = await fetch('/api/commands/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guildId: selectedGuild })
            })
            const data = await res.json()
            if (data.success) {
                const conflictNote = data.conflicts?.length
                    ? `（ビルトインと重複: /${data.conflicts.join(', /')} は除外）`
                    : ''
                showToast(`✅ ${data.count}個のコマンドをDiscordに同期しました！${conflictNote}`)
                const regRes = await fetch(`/api/commands/registered${selectedGuild ? `?guildId=${selectedGuild}` : ''}`)
                setRegisteredCommands(await regRes.json())
            } else {
                showToast(data.error || '同期に失敗しました', 'error')
            }
        } catch {
            showToast('同期中にエラーが発生しました', 'error')
        }
        setSyncing(false)
    }

    // Option management
    const addOption = () => {
        setForm({ ...form, options: [...(form.options || []), { ...defaultOption }] })
    }

    const updateOption = (index, field, value) => {
        const opts = [...form.options]
        opts[index] = { ...opts[index], [field]: value }
        if (field === 'name') {
            opts[index].name = value.toLowerCase().replace(/\s/g, '_').replace(/[^a-z0-9_]/g, '')
        }
        setForm({ ...form, options: opts })
    }

    const removeOption = (index) => {
        setForm({ ...form, options: form.options.filter((_, i) => i !== index) })
    }

    // Random response management
    const addRandomResponse = () => {
        setForm({ ...form, randomResponses: [...(form.randomResponses || []), ''] })
    }

    const updateRandomResponse = (index, value) => {
        const responses = [...(form.randomResponses || [])]
        responses[index] = value
        setForm({ ...form, randomResponses: responses })
    }

    const removeRandomResponse = (index) => {
        setForm({ ...form, randomResponses: form.randomResponses.filter((_, i) => i !== index) })
    }

    // Permission toggle
    const togglePermission = (perm) => {
        const perms = form.requiredPermissions || []
        setForm({
            ...form,
            requiredPermissions: perms.includes(perm)
                ? perms.filter(p => p !== perm)
                : [...perms, perm]
        })
    }

    // Role toggle
    const toggleRole = (roleId) => {
        const roles = form.allowedRoles || []
        setForm({
            ...form,
            allowedRoles: roles.includes(roleId)
                ? roles.filter(r => r !== roleId)
                : [...roles, roleId]
        })
    }

    const builtinCommands = [
        { name: 'balance', desc: 'ポイント残高確認', icon: '💰' },
        { name: 'transfer', desc: 'ポイント送金', icon: '💸' },
        { name: 'pay', desc: 'ポイント支払い', icon: '💳' },
        { name: 'ranking', desc: 'ランキング表示', icon: '🏆' },
        { name: 'daily', desc: 'デイリーボーナス', icon: '🎁' },
        { name: 'history', desc: '取引履歴', icon: '📜' },
        { name: 'actions', desc: 'アクション一覧', icon: '📋' },
        { name: 'gacha', desc: 'ガチャ', icon: '🎰' },
        { name: 'coinflip', desc: 'コインフリップ', icon: '🪙' },
    ]

    const getResponseIcon = (type) => {
        return type === 'text' ? '💬' : type === 'embed' ? '🎨' : type === 'random' ? '🎲' : '💬'
    }

    const getFeatureBadges = (cmd) => {
        const badges = []
        if (cmd.options?.length > 0) badges.push({ label: `${cmd.options.length}オプション`, color: 'var(--accent-info)' })
        if (cmd.requiredPermissions?.length > 0) badges.push({ label: '🔒 権限制限', color: 'var(--accent-warning)' })
        if (cmd.allowedRoles?.length > 0) badges.push({ label: '👑 ロール制限', color: 'var(--accent-primary-light)' })
        if (cmd.dmResponse) badges.push({ label: '📩 DM', color: 'var(--accent-success)' })
        if (cmd.responseType === 'random') badges.push({ label: '🎲 ランダム', color: 'var(--accent-danger)' })
        return badges
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>⌨️ コマンドビルダー</h1>
                <p>スラッシュコマンドをビジュアルに作成・管理し、Discordに同期できます</p>
            </div>

            <div className="flex-between mb-lg">
                <div className="flex-row gap-md">
                    <span className="badge badge-accent">{commands.length} コマンド</span>
                    <span className="badge badge-online">{commands.filter(c => c.enabled).length} 有効</span>
                    {registeredCommands.length > 0 && (
                        <span className="badge badge-info">Discord登録: {registeredCommands.length}</span>
                    )}
                </div>
                <div className="flex-row gap-md">
                    {botStatus === 'online' && (
                        <button className="btn btn-success" onClick={syncToDiscord} disabled={syncing}
                            style={{ opacity: syncing ? 0.6 : 1 }}>
                            {syncing ? '⏳ 同期中...' : '🔄 Discordに同期'}
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={openNew}>
                        ＋ 新しいコマンド
                    </button>
                </div>
            </div>

            {/* Built-in Point Commands Banner */}
            <div className="card" style={{
                marginBottom: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.05) 0%, rgba(255, 179, 71, 0.03) 100%)',
                borderColor: 'rgba(124, 92, 252, 0.12)'
            }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                    🤖 ビルトインポイントコマンド（自動登録）
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {builtinCommands.map(cmd => (
                        <span key={cmd.name} style={{
                            padding: '4px 12px', background: 'rgba(124, 92, 252, 0.08)',
                            border: '1px solid rgba(124, 92, 252, 0.15)',
                            borderRadius: 'var(--radius-full)', fontSize: '0.8rem',
                            fontFamily: 'var(--font-mono)', color: 'var(--accent-primary-light)',
                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                            {cmd.icon} /{cmd.name}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-primary)' }}>
                                {cmd.desc}
                            </span>
                        </span>
                    ))}
                </div>
            </div>

            {/* Registered commands banner */}
            {registeredCommands.length > 0 && (
                <div className="card" style={{
                    marginBottom: 'var(--spacing-md)',
                    padding: 'var(--spacing-md)',
                    background: 'rgba(74, 222, 128, 0.03)',
                    borderColor: 'rgba(74, 222, 128, 0.12)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            📡 Discordに登録済みのコマンド ({registeredCommands.length})
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                            📥 取り込み &nbsp; ✕ 削除
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {registeredCommands.map(cmd => {
                            const isInDashboard = commands.some(c => c.name === cmd.name)
                            return (
                                <span key={cmd.id} style={{
                                    padding: '3px 10px', background: isInDashboard ? 'rgba(74, 222, 128, 0.12)' : 'rgba(74, 222, 128, 0.05)',
                                    border: `1px solid ${isInDashboard ? 'rgba(74, 222, 128, 0.25)' : 'rgba(74, 222, 128, 0.12)'}`,
                                    borderRadius: 'var(--radius-full)', fontSize: '0.8rem',
                                    fontFamily: 'var(--font-mono)', color: 'var(--accent-success)',
                                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                                }}>
                                    /{cmd.name}
                                    {isInDashboard ? (
                                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }} title="ダッシュボードに存在">✓</span>
                                    ) : (
                                        <button
                                            onClick={() => importRegisteredCommand(cmd)}
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: 'var(--accent-primary-light)', fontSize: '0.75rem',
                                                padding: '0 2px', lineHeight: 1,
                                            }}
                                            title={`/${cmd.name} をダッシュボードに取り込む`}
                                        >📥</button>
                                    )}
                                    <button
                                        onClick={async () => {
                                            if (!confirm(`「/${cmd.name}」をDiscordから削除しますか？`)) return
                                            try {
                                                await fetch(`/api/commands/registered/${cmd.id}${selectedGuild ? `?guildId=${selectedGuild}` : ''}`, { method: 'DELETE' })
                                                setRegisteredCommands(registeredCommands.filter(r => r.id !== cmd.id))
                                                showToast(`/${cmd.name} をDiscordから削除しました`)
                                            } catch {
                                                showToast('削除に失敗しました', 'error')
                                            }
                                        }}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--text-tertiary)', fontSize: '0.7rem',
                                            padding: '0 2px', lineHeight: 1,
                                            transition: 'color 0.2s'
                                        }}
                                        onMouseEnter={e => e.target.style.color = 'var(--accent-danger)'}
                                        onMouseLeave={e => e.target.style.color = 'var(--text-tertiary)'}
                                        title={`/${cmd.name} をDiscordから削除`}
                                    >✕</button>
                                </span>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Command list */}
            <div className="feature-list" style={{ gap: 'var(--spacing-md)' }}>
                {commands.map((cmd) => {
                    const badges = getFeatureBadges(cmd)
                    return (
                        <div key={cmd.id} className="card" style={{
                            padding: 'var(--spacing-md) var(--spacing-lg)',
                            opacity: cmd.enabled ? 1 : 0.5,
                            transition: 'all 0.3s ease'
                        }}>
                            <div className="flex-between">
                                <div className="flex-row gap-md">
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                        background: 'rgba(124, 92, 252, 0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.2rem'
                                    }}>
                                        {getResponseIcon(cmd.responseType)}
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <code style={{
                                                background: 'var(--bg-glass)', padding: '2px 8px',
                                                borderRadius: '4px', fontWeight: 600, fontSize: '0.95rem'
                                            }}>/{cmd.name}</code>
                                            {cmd.cooldown > 0 && (
                                                <span className="badge badge-warning">⏱ {cmd.cooldown}s</span>
                                            )}
                                            {registeredCommands.some(r => r.name === cmd.name) && (
                                                <span className="badge badge-online" style={{ fontSize: '0.65rem' }}>同期済</span>
                                            )}
                                            {badges.map((b, i) => (
                                                <span key={i} style={{
                                                    fontSize: '0.65rem', padding: '1px 6px',
                                                    borderRadius: 'var(--radius-full)',
                                                    border: `1px solid ${b.color}30`,
                                                    color: b.color, fontWeight: 600
                                                }}>{b.label}</span>
                                            ))}
                                            {cmd.pointCost > 0 && (
                                                <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255, 183, 77, 0.3)', color: '#ffb74d', fontWeight: 600 }}>
                                                    💸 {cmd.pointCost}pt
                                                </span>
                                            )}
                                            {(cmd.pointRewardMin > 0 || cmd.pointRewardMax > 0) && (
                                                <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(76, 175, 80, 0.3)', color: '#4caf50', fontWeight: 600 }}>
                                                    🎁 {cmd.pointRewardMin === cmd.pointRewardMax ? `+${cmd.pointRewardMin}pt` : `+${cmd.pointRewardMin}~${cmd.pointRewardMax}pt`}
                                                </span>
                                            )}
                                        </div>
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            {cmd.description}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex-row gap-md">
                                    <label className="toggle">
                                        <input type="checkbox" checked={cmd.enabled} onChange={() => toggleEnabled(cmd.id)} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <button className="btn-icon" onClick={() => openEdit(cmd)}>✏️</button>
                                    <button className="btn-icon" onClick={() => handleDelete(cmd.id)}
                                        style={{ color: 'var(--accent-danger)' }}>🗑️</button>
                                </div>
                            </div>
                            <div style={{
                                marginTop: 'var(--spacing-md)',
                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                background: 'var(--bg-glass)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)',
                                fontFamily: 'var(--font-mono)'
                            }}>
                                {cmd.responseType === 'embed'
                                    ? `📦 Embed: ${cmd.embedTitle || '(タイトルなし)'}`
                                    : cmd.responseType === 'random'
                                        ? `🎲 ランダム応答: ${(cmd.randomResponses || []).length}パターン`
                                        : cmd.responseText || '(応答未設定)'}
                            </div>
                        </div>
                    )
                })}
            </div>

            {commands.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">⌨️</div>
                    <h3>コマンドがまだありません</h3>
                    <p>「新しいコマンド」ボタンから最初のコマンドを作成しましょう</p>
                    <button className="btn btn-primary" onClick={openNew}>＋ 新しいコマンド</button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px', maxHeight: '85vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <h2>{editingCommand ? 'コマンドを編集' : '新しいコマンド'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        {/* Tabs */}
                        <div className="tabs" style={{ marginBottom: 'var(--spacing-md)' }}>
                            {[
                                { id: 'basic', label: '📝 基本設定' },
                                { id: 'response', label: '💬 応答' },
                                { id: 'points', label: '💰 ポイント' },
                                { id: 'options', label: `🔧 オプション (${(form.options || []).length})` },
                                { id: 'access', label: '🔒 アクセス制御' },
                            ].map(tab => (
                                <button key={tab.id}
                                    className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >{tab.label}</button>
                            ))}
                        </div>

                        {/* Basic Tab */}
                        {activeTab === 'basic' && (
                            <>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">コマンド名</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{
                                                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                                                color: 'var(--text-tertiary)', fontWeight: 600
                                            }}>/</span>
                                            <input
                                                className="form-input"
                                                placeholder="hello"
                                                value={form.name}
                                                onChange={e => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                                                style={{ paddingLeft: '28px' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">クールダウン（秒）</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            min="0"
                                            value={form.cooldown}
                                            onChange={e => setForm({ ...form, cooldown: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">コマンドの説明</label>
                                    <input
                                        className="form-input"
                                        placeholder="このコマンドの説明..."
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                    />
                                </div>

                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>Ephemeral（自分のみ表示）</span>
                                        </label>
                                        <label className="toggle">
                                            <input type="checkbox" checked={form.ephemeral}
                                                onChange={e => setForm({ ...form, ephemeral: e.target.checked })} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>📩 DMで送信</span>
                                        </label>
                                        <label className="toggle">
                                            <input type="checkbox" checked={form.dmResponse}
                                                onChange={e => setForm({ ...form, dmResponse: e.target.checked })} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Response Tab */}
                        {activeTab === 'response' && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">応答タイプ</label>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        {responseTypes.map(rt => (
                                            <button key={rt.value}
                                                className={`btn ${form.responseType === rt.value ? 'btn-primary' : 'btn-secondary'}`}
                                                style={{ flex: 1, justifyContent: 'center' }}
                                                onClick={() => setForm({ ...form, responseType: rt.value })}
                                            >
                                                {rt.icon} {rt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {form.responseType === 'text' && (
                                    <div className="form-group">
                                        <label className="form-label">応答メッセージ</label>
                                        <textarea
                                            className="form-input form-textarea"
                                            placeholder="こんにちは！ {user} さん"
                                            value={form.responseText}
                                            onChange={e => setForm({ ...form, responseText: e.target.value })}
                                        />
                                    </div>
                                )}

                                {form.responseType === 'random' && (
                                    <div className="form-group">
                                        <label className="form-label">ランダム応答パターン</label>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-sm)' }}>
                                            複数のパターンからランダムに1つが選ばれます
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                            {(form.randomResponses || ['']).map((resp, i) => (
                                                <div key={i} style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-start' }}>
                                                    <span style={{
                                                        padding: '8px 0', fontSize: '0.75rem', color: 'var(--text-tertiary)',
                                                        fontWeight: 700, minWidth: '24px', textAlign: 'center'
                                                    }}>#{i + 1}</span>
                                                    <textarea
                                                        className="form-input form-textarea"
                                                        style={{ flex: 1, minHeight: '40px', resize: 'vertical' }}
                                                        placeholder={`パターン${i + 1}の応答テキスト...`}
                                                        value={resp}
                                                        onChange={e => updateRandomResponse(i, e.target.value)}
                                                    />
                                                    {form.randomResponses.length > 1 && (
                                                        <button className="btn-icon" onClick={() => removeRandomResponse(i)}
                                                            style={{ color: 'var(--accent-danger)', padding: '8px' }}>✕</button>
                                                    )}
                                                </div>
                                            ))}
                                            <button className="btn btn-secondary btn-sm" onClick={addRandomResponse}>
                                                ＋ パターンを追加
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {form.responseType === 'embed' && (
                                    <>
                                        <div className="grid-2">
                                            <div className="form-group">
                                                <label className="form-label">Embedタイトル</label>
                                                <input className="form-input" placeholder="タイトル"
                                                    value={form.embedTitle || ''}
                                                    onChange={e => setForm({ ...form, embedTitle: e.target.value })} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">カラー</label>
                                                <div className="flex-row">
                                                    <input type="color" value={form.embedColor || '#7c5cfc'}
                                                        onChange={e => setForm({ ...form, embedColor: e.target.value })}
                                                        style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                                                    <input className="form-input" value={form.embedColor || '#7c5cfc'}
                                                        onChange={e => setForm({ ...form, embedColor: e.target.value })} style={{ flex: 1 }} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Embed説明</label>
                                            <textarea className="form-input form-textarea" placeholder="Embedの本文..."
                                                value={form.embedDescription || ''}
                                                onChange={e => setForm({ ...form, embedDescription: e.target.value })} />
                                        </div>
                                    </>
                                )}

                                {/* Variables Reference */}
                                <div style={{
                                    padding: 'var(--spacing-md)',
                                    background: 'var(--bg-glass)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h4 style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-sm)' }}>
                                        📝 使用可能な変数
                                    </h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {allVariables.map(v => (
                                            <span key={v.var} className="tooltip" data-tooltip={v.desc}
                                                style={{
                                                    padding: '2px 8px', background: 'rgba(124, 92, 252, 0.1)',
                                                    borderRadius: '4px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)',
                                                    color: 'var(--accent-primary-light)', cursor: 'pointer'
                                                }}
                                                onClick={() => {
                                                    if (form.responseType === 'text') {
                                                        setForm({ ...form, responseText: form.responseText + v.var })
                                                    } else if (form.responseType === 'embed') {
                                                        setForm({ ...form, embedDescription: (form.embedDescription || '') + v.var })
                                                    }
                                                }}
                                            >
                                                {v.var}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Options Tab */}
                        {activeTab === 'options' && (
                            <>
                                <div className="card" style={{
                                    marginBottom: 'var(--spacing-md)',
                                    background: 'linear-gradient(135deg, rgba(77, 184, 255, 0.06) 0%, rgba(124, 92, 252, 0.03) 100%)',
                                    borderColor: 'rgba(77, 184, 255, 0.12)'
                                }}>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                        🔧 コマンドにオプション（引数）を追加できます。応答メッセージ内で <code style={{ background: 'var(--bg-glass)', padding: '1px 4px', borderRadius: '3px' }}>{'{option:名前}'}</code> で値を埋め込めます。
                                    </p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                    {(form.options || []).map((opt, i) => (
                                        <div key={i} className="card" style={{
                                            padding: 'var(--spacing-md)',
                                            borderColor: 'rgba(77, 184, 255, 0.15)'
                                        }}>
                                            <div className="flex-between" style={{ marginBottom: 'var(--spacing-sm)' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    オプション #{i + 1}
                                                </span>
                                                <button className="btn-icon" onClick={() => removeOption(i)}
                                                    style={{ color: 'var(--accent-danger)' }}>✕</button>
                                            </div>
                                            <div className="grid-2" style={{ gap: 'var(--spacing-sm)' }}>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label">名前</label>
                                                    <input className="form-input" placeholder="option_name"
                                                        value={opt.name}
                                                        onChange={e => updateOption(i, 'name', e.target.value)} />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label">タイプ</label>
                                                    <select className="form-input" value={opt.type}
                                                        onChange={e => updateOption(i, 'type', e.target.value)}
                                                        style={{ cursor: 'pointer' }}>
                                                        {optionTypes.map(ot => (
                                                            <option key={ot.value} value={ot.value}>{ot.icon} {ot.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0, marginTop: 'var(--spacing-sm)' }}>
                                                <label className="form-label">説明</label>
                                                <input className="form-input" placeholder="オプションの説明..."
                                                    value={opt.description}
                                                    onChange={e => updateOption(i, 'description', e.target.value)} />
                                            </div>
                                            <div style={{ marginTop: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={opt.required}
                                                        onChange={e => updateOption(i, 'required', e.target.checked)} />
                                                    <span>必須</span>
                                                </label>
                                                {opt.name && (
                                                    <span style={{
                                                        fontSize: '0.75rem', padding: '2px 6px',
                                                        background: 'rgba(124, 92, 252, 0.08)',
                                                        borderRadius: '4px', fontFamily: 'var(--font-mono)',
                                                        color: 'var(--accent-primary-light)'
                                                    }}>
                                                        {`{option:${opt.name}}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button className="btn btn-secondary" onClick={addOption} style={{ marginTop: 'var(--spacing-md)' }}>
                                    ＋ オプションを追加
                                </button>
                            </>
                        )}

                        {/* Access Control Tab */}
                        {activeTab === 'access' && (
                            <>
                                {/* Permission Restrictions */}
                                <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 'var(--spacing-sm)' }}>
                                        🔒 権限制限
                                    </h4>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-md)' }}>
                                        選択した権限をすべて持つメンバーのみ実行可能（未選択で全員可）
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                                        {permissionOptions.map(perm => {
                                            const active = (form.requiredPermissions || []).includes(perm.value)
                                            return (
                                                <button key={perm.value}
                                                    className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => togglePermission(perm.value)}
                                                    style={{ fontSize: '0.8rem' }}
                                                >
                                                    {active ? '✅' : '⬜'} {perm.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Role Restrictions */}
                                <div className="card">
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 'var(--spacing-sm)' }}>
                                        👑 ロール制限
                                    </h4>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-md)' }}>
                                        選択したロールのいずれかを持つメンバーのみ実行可能（未選択で全員可）
                                    </p>
                                    {currentGuild ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                            {(currentGuild.roles || []).map(role => {
                                                const active = (form.allowedRoles || []).includes(role.id)
                                                return (
                                                    <button key={role.id}
                                                        className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                                                        onClick={() => toggleRole(role.id)}
                                                        style={{
                                                            fontSize: '0.78rem',
                                                            borderColor: active ? undefined : (role.color !== '#000000' ? role.color + '40' : undefined),
                                                        }}
                                                    >
                                                        <span style={{
                                                            width: 8, height: 8, borderRadius: '50%',
                                                            background: role.color !== '#000000' ? role.color : 'var(--text-tertiary)',
                                                            display: 'inline-block', marginRight: '4px'
                                                        }} />
                                                        {role.name}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                                            ボットを接続してサーバーを選択すると、ロール一覧が表示されます
                                        </p>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Points Tab */}
                        {activeTab === 'points' && (
                            <>
                                <div className="card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)', background: 'rgba(255, 183, 77, 0.05)', borderColor: 'rgba(255, 183, 77, 0.15)' }}>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                                        💡 コマンドにポイントの「使用料」や「報酬」を設定できます。ユーザーがコマンドを実行すると自動的にポイントが消費/付与されます。
                                    </p>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">💸 ポイントコスト（使用料）</label>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                                        コマンドを使うたびにこのポイントが差し引かれます。無料にする場合は 0 のまま。
                                    </p>
                                    <input type="number" className="form-input" min="0" step="1"
                                        value={form.pointCost}
                                        onChange={e => setForm({ ...form, pointCost: parseFloat(e.target.value) || 0 })}
                                        placeholder="0"
                                    />
                                </div>

                                <div style={{ borderTop: '1px solid var(--border-primary)', margin: 'var(--spacing-md) 0', paddingTop: 'var(--spacing-md)' }}>
                                    <label className="form-label">🎁 ポイント報酬（コマンド実行時に獲得）</label>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                                        最小と最大を別の値にするとランダム報酬になります。同じにすると固定報酬。
                                    </p>
                                    <div className="grid-2">
                                        <div className="form-group">
                                            <label className="form-label" style={{ fontSize: '0.78rem' }}>最小報酬</label>
                                            <input type="number" className="form-input" min="0" step="1"
                                                value={form.pointRewardMin}
                                                onChange={e => setForm({ ...form, pointRewardMin: parseFloat(e.target.value) || 0 })}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" style={{ fontSize: '0.78rem' }}>最大報酬</label>
                                            <input type="number" className="form-input" min="0" step="1"
                                                value={form.pointRewardMax}
                                                onChange={e => setForm({ ...form, pointRewardMax: parseFloat(e.target.value) || 0 })}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {(form.pointCost > 0 || form.pointRewardMin > 0 || form.pointRewardMax > 0) && (
                                    <div className="card" style={{ padding: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', background: 'var(--bg-glass)' }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>🔍 プレビュー</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                            {form.pointCost > 0 && <div>💸 コスト: -{form.pointCost}pt</div>}
                                            {form.pointRewardMin > 0 && form.pointRewardMin === form.pointRewardMax && (
                                                <div>🎁 報酬: +{form.pointRewardMin}pt（固定）</div>
                                            )}
                                            {form.pointRewardMin > 0 && form.pointRewardMin !== form.pointRewardMax && (
                                                <div>🎁 報酬: +{form.pointRewardMin}pt ～ +{form.pointRewardMax}pt（ランダム）</div>
                                            )}
                                            {form.pointCost > 0 && form.pointRewardMin > 0 && (
                                                <div style={{ marginTop: 4, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                                                    → 最悪損益: {form.pointRewardMin - form.pointCost > 0 ? '+' : ''}{form.pointRewardMin - form.pointCost}pt
                                                    {form.pointRewardMax !== form.pointRewardMin && ` ～ ${form.pointRewardMax - form.pointCost > 0 ? '+' : ''}${form.pointRewardMax - form.pointCost}pt`}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>キャンセル</button>
                            <button className="btn btn-primary" onClick={handleSave}>
                                {editingCommand ? '💾 保存' : '＋ 追加'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
