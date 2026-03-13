import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import BotSetup from './pages/BotSetup'
import CommandBuilder from './pages/CommandBuilder'
import AutoResponse from './pages/AutoResponse'
import WelcomeMessages from './pages/WelcomeMessages'
import ScheduledMessages from './pages/ScheduledMessages'
import Moderation from './pages/Moderation'
import EmbedBuilder from './pages/EmbedBuilder'
import PointSystem from './pages/PointSystem'
import PointLeaderboard from './pages/PointLeaderboard'
import Rewards from './pages/Rewards'
import RankSystem from './pages/RankSystem'
import { useState, useEffect, useRef, createContext } from 'react'

export const AppContext = createContext()

function App() {
    const [botStatus, setBotStatus] = useState('offline')
    const [botName, setBotName] = useState('')
    const [botAvatar, setBotAvatar] = useState('')
    const [guilds, setGuilds] = useState([])
    const [selectedGuild, setSelectedGuild] = useState(() => localStorage.getItem('selectedGuild'))
    const [toast, setToast] = useState(null)
    const guildInitialized = useRef(false)

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    // Check bot status on load (handles auto-reconnect)
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/bot/status')
                const data = await res.json()
                if (data.status === 'online') {
                    setBotStatus('online')
                    setBotName(data.username || '')
                    setBotAvatar(data.avatarUrl || '')
                    // Fetch guilds
                    const gRes = await fetch('/api/guilds')
                    const gData = await gRes.json()
                    setGuilds(gData)
                    // Only auto-select the first guild once on initial load
                    if (gData.length > 0 && !guildInitialized.current) {
                        guildInitialized.current = true
                        const saved = localStorage.getItem('selectedGuild')
                        const validSaved = saved && gData.some(g => g.id === saved)
                        setSelectedGuild(validSaved ? saved : gData[0].id)
                    }
                } else {
                    setBotStatus('offline')
                }
            } catch { }
        }
        checkStatus()
        // Poll every 10 seconds
        const interval = setInterval(checkStatus, 10000)
        return () => clearInterval(interval)
    }, [])

    const refreshGuilds = async () => {
        try {
            const res = await fetch('/api/guilds')
            const data = await res.json()
            setGuilds(data)
        } catch { }
    }

    return (
        <AppContext.Provider value={{
            botStatus, setBotStatus,
            botName, setBotName,
            botAvatar, setBotAvatar,
            guilds, setGuilds, refreshGuilds,
            selectedGuild, setSelectedGuild: (id) => { localStorage.setItem('selectedGuild', id); setSelectedGuild(id) },
            showToast
        }}>
            <Router>
                <div className="app-layout">
                    <Sidebar />
                    <main className="main-content">
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/setup" element={<BotSetup />} />
                            <Route path="/commands" element={<CommandBuilder />} />
                            <Route path="/auto-response" element={<AutoResponse />} />
                            <Route path="/welcome" element={<WelcomeMessages />} />
                            <Route path="/scheduled" element={<ScheduledMessages />} />
                            <Route path="/moderation" element={<Moderation />} />
                            <Route path="/embed" element={<EmbedBuilder />} />
                            <Route path="/points" element={<PointSystem />} />
                            <Route path="/leaderboard" element={<PointLeaderboard />} />
                            <Route path="/rewards" element={<Rewards />} />
                            <Route path="/ranks" element={<RankSystem />} />
                        </Routes>
                    </main>
                    {toast && (
                        <div className="toast-container">
                            <div className={`toast toast-${toast.type}`}>
                                {toast.type === 'success' ? '✅' : '❌'} {toast.message}
                            </div>
                        </div>
                    )}
                </div>
            </Router>
        </AppContext.Provider>
    )
}

export default App
