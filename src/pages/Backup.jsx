import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../App'

export default function Backup() {
    const { showToast } = useContext(AppContext)
    const [info, setInfo] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [downloading, setDownloading] = useState(false)

    const fetchInfo = () => {
        fetch('/api/backup/info').then(r => r.json()).then(setInfo).catch(() => { })
    }

    useEffect(() => { fetchInfo() }, [])

    const handleDownload = async () => {
        setDownloading(true)
        try {
            const res = await fetch('/api/backup/download')
            if (!res.ok) throw new Error('ダウンロードに失敗しました')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `botforge-backup-${new Date().toISOString().split('T')[0]}.db`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            showToast('バックアップをダウンロードしました')
        } catch (err) {
            showToast(err.message || 'ダウンロードに失敗しました', 'error')
        } finally {
            setDownloading(false)
        }
    }

    const handleUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.name.endsWith('.db')) {
            showToast('.db ファイルを選択してください', 'error')
            return
        }

        if (!window.confirm('現在のデータベースを上書きします。\nこの操作は取り消せません。よろしいですか？')) {
            e.target.value = ''
            return
        }
        if (!window.confirm('最終確認: 本当にデータベースをリストアしますか？\n現在のデータは自動的にバックアップされます。')) {
            e.target.value = ''
            return
        }

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('database', file)
            const res = await fetch('/api/backup/upload', {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'アップロードに失敗しました')
            showToast(data.message || 'リストアに成功しました')
            fetchInfo()
        } catch (err) {
            showToast(err.message || 'アップロードに失敗しました', 'error')
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>💾 バックアップ & リストア</h1>
                <p>データベースのバックアップとリストアを管理します</p>
            </div>

            {/* DB情報 */}
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="card-header">
                    <h2>📊 データベース情報</h2>
                    <button className="btn btn-secondary" onClick={fetchInfo}
                        style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                        更新
                    </button>
                </div>
                {info ? (
                    <div className="grid-2" style={{ gap: 'var(--spacing-md)' }}>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>ファイルサイズ</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                                {info.sizeMB < 1 ? `${Math.round(info.sizeBytes / 1024)} KB` : `${info.sizeMB} MB`}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>テーブル数</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{info.tables}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>最終更新</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                {new Date(info.lastModified).toLocaleString('ja-JP')}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-tertiary)' }}>読み込み中...</p>
                )}
            </div>

            {/* ダウンロード */}
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="card-header">
                    <div>
                        <h2>📥 バックアップダウンロード</h2>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            現在のデータベースをそのままダウンロードします。定期的にバックアップを取ることを推奨します。
                        </p>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
                    {downloading ? 'ダウンロード中...' : '📥 バックアップをダウンロード'}
                </button>
            </div>

            {/* アップロード */}
            <div className="card" style={{ borderColor: 'rgba(255, 71, 87, 0.2)' }}>
                <div className="card-header">
                    <div>
                        <h2>📤 リストア（データベース復元）</h2>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            バックアップファイル（.db）をアップロードして、データベースを復元します。
                            現在のデータは自動的に .bak ファイルとして保存されます。
                        </p>
                    </div>
                </div>
                <div className="card" style={{
                    background: 'linear-gradient(135deg, rgba(255, 71, 87, 0.06) 0%, rgba(255, 107, 107, 0.03) 100%)',
                    borderColor: 'rgba(255, 71, 87, 0.15)',
                    marginBottom: 'var(--spacing-md)'
                }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--accent-danger)' }}>
                        ⚠️ リストアすると現在のデータが上書きされます。リストア後はサーバーの再起動が必要です。
                    </p>
                </div>
                <label className="btn btn-danger" style={{ cursor: 'pointer', display: 'inline-block' }}>
                    {uploading ? 'アップロード中...' : '📤 バックアップファイルを選択'}
                    <input type="file" accept=".db" onChange={handleUpload}
                        style={{ display: 'none' }} disabled={uploading} />
                </label>
            </div>
        </div>
    )
}
