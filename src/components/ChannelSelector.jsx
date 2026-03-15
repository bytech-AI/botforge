import { useState, useMemo, useEffect } from 'react'

/**
 * カテゴリ別にグループ化されたチャンネルセレクター
 *
 * @param {object} props
 * @param {Array<{id: string, name: string, parentId: string|null}>} props.channels - チャンネル一覧
 * @param {Array<{id: string, name: string}>} props.categories - カテゴリ一覧
 * @param {'multi'|'single'|'dropdown'} props.mode - 選択モード
 * @param {string[]} props.selectedIds - 選択中のチャンネルID配列 (multi)
 * @param {string} props.selectedId - 選択中のチャンネルID (single/dropdown)
 * @param {(ids: string[]) => void} props.onChangeMulti - 複数選択変更コールバック
 * @param {(id: string) => void} props.onChangeSingle - 単一選択変更コールバック
 * @param {string[]} props.excludeIds - 除外するチャンネルID
 * @param {string} props.placeholder - プレースホルダーテキスト
 * @param {string} props.emptyText - チャンネルがない場合のテキスト
 */
export default function ChannelSelector({
  channels = [],
  categories = [],
  mode = 'multi',
  selectedIds = [],
  selectedId = '',
  onChangeMulti,
  onChangeSingle,
  excludeIds = [],
  placeholder = 'チャンネルを選択...',
  emptyText = 'チャンネル情報を取得できません',
  storageKey = '',
}) {
  // デフォルトは全カテゴリ折り畳み。localStorageから復元
  const [collapsedCategories, setCollapsedCategories] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`cs_${storageKey}`)
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return { __defaultCollapsed: true }
  })

  // 変更時にlocalStorageへ保存
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`cs_${storageKey}`, JSON.stringify(collapsedCategories))
    }
  }, [collapsedCategories, storageKey])

  // チャンネルをカテゴリ別にグループ化
  const grouped = useMemo(() => {
    const available = channels.filter(ch => !excludeIds.includes(ch.id))
    const categoryMap = new Map()

    // カテゴリの初期化（順序を保持）
    for (const cat of categories) {
      categoryMap.set(cat.id, { category: cat, channels: [] })
    }
    // カテゴリなしグループ
    categoryMap.set(null, { category: { id: null, name: 'カテゴリなし' }, channels: [] })

    for (const ch of available) {
      const group = categoryMap.get(ch.parentId) || categoryMap.get(null)
      group.channels.push(ch)
    }

    // 空のグループを除外
    return Array.from(categoryMap.values()).filter(g => g.channels.length > 0)
  }, [channels, categories, excludeIds])

  // デフォルト折り畳みの場合、明示的にfalseでなければ折り畳み
  const isCategoryCollapsed = (catKey) => {
    if (collapsedCategories[catKey] !== undefined) return collapsedCategories[catKey]
    return !!collapsedCategories.__defaultCollapsed
  }

  const toggleCategory = (categoryId) => {
    setCollapsedCategories(prev => ({ ...prev, [categoryId]: !isCategoryCollapsed(categoryId) }))
  }

  // カテゴリ内の全チャンネルを一括選択/解除（multiモードのみ）
  const toggleCategorySelection = (categoryChannels) => {
    if (!onChangeMulti) return
    const categoryIds = categoryChannels.map(ch => ch.id)
    const allSelected = categoryIds.every(id => selectedIds.includes(id))
    if (allSelected) {
      onChangeMulti(selectedIds.filter(id => !categoryIds.includes(id)))
    } else {
      const newIds = [...new Set([...selectedIds, ...categoryIds])]
      onChangeMulti(newIds)
    }
  }

  const toggleChannel = (channelId) => {
    if (!onChangeMulti) return
    if (selectedIds.includes(channelId)) {
      onChangeMulti(selectedIds.filter(id => id !== channelId))
    } else {
      onChangeMulti([...selectedIds, channelId])
    }
  }

  if (channels.length === 0) {
    return <p className="channel-selector-empty">{emptyText}</p>
  }

  // ドロップダウンモード（単一選択のselect要素）
  if (mode === 'dropdown') {
    return (
      <select
        className="form-input"
        value={selectedId}
        onChange={e => onChangeSingle?.(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {grouped.map(group => (
          <optgroup key={group.category.id ?? '_none'} label={group.category.name}>
            {group.channels.map(ch => (
              <option key={ch.id} value={ch.id}>#{ch.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    )
  }

  // singleモード（ラジオボタン）
  if (mode === 'single') {
    return (
      <div className="channel-selector">
        {grouped.map(group => {
          const catKey = group.category.id ?? '_none'
          const collapsed = isCategoryCollapsed(catKey)
          return (
            <div key={catKey} className="channel-category-group">
              <div
                className="channel-category-header"
                onClick={() => toggleCategory(catKey)}
              >
                <span className="channel-category-arrow">{collapsed ? '▶' : '▼'}</span>
                <span className="channel-category-name">{group.category.name}</span>
                <span className="channel-category-count">({group.channels.length})</span>
              </div>
              {!collapsed && (
                <div className="channel-category-channels">
                  {group.channels.map(ch => (
                    <label key={ch.id} className="channel-item">
                      <input
                        type="radio"
                        name="channel-selector-single"
                        checked={selectedId === ch.id}
                        onChange={() => onChangeSingle?.(ch.id)}
                      />
                      <span className="channel-hash">#</span>
                      <span className="channel-name">{ch.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // multiモード（チェックボックス）
  return (
    <div className="channel-selector">
      {grouped.map(group => {
        const catKey = group.category.id ?? '_none'
        const collapsed = isCategoryCollapsed(catKey)
        const categoryIds = group.channels.map(ch => ch.id)
        const selectedCount = categoryIds.filter(id => selectedIds.includes(id)).length
        const allSelected = selectedCount === categoryIds.length

        return (
          <div key={catKey} className="channel-category-group">
            <div className="channel-category-header">
              <span
                className="channel-category-arrow"
                onClick={() => toggleCategory(catKey)}
                style={{ cursor: 'pointer' }}
              >
                {collapsed ? '▶' : '▼'}
              </span>
              <label className="channel-category-label">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => toggleCategorySelection(group.channels)}
                />
                <span className="channel-category-name">{group.category.name}</span>
              </label>
              <span className="channel-category-count">
                ({selectedCount}/{categoryIds.length})
              </span>
            </div>
            {!collapsed && (
              <div className="channel-category-channels">
                {group.channels.map(ch => (
                  <label key={ch.id} className="channel-item">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(ch.id)}
                      onChange={() => toggleChannel(ch.id)}
                    />
                    <span className="channel-hash">#</span>
                    <span className="channel-name">{ch.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
