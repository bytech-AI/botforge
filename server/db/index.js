/**
 * DB モジュール統合エントリポイント
 * 全てのDB関数をre-exportし、既存のimportパスとの互換性を維持する
 */

// DB接続・初期化・cronロック
export { initDatabase, getDb, acquireCronLock, cleanupCronLocks } from './connection.js'

// コマンド管理
export { getAllCommands, createCommand, updateCommand, deleteCommand } from './commands.js'

// 6機能（自動応答・モデレーション・定時メッセージ・入退室・Embed・チャンネル倍率・ポイント減衰）
export {
  getAllAutoResponses, getAutoResponsesGlobal, createAutoResponse, updateAutoResponse, deleteAutoResponse,
  getModerationSettings, updateModerationSettings,
  getAllScheduledMessages, createScheduledMessage, updateScheduledMessage, deleteScheduledMessage,
  getWelcomeSettings, updateWelcomeSettings,
  getAllEmbedTemplates, createEmbedTemplate, updateEmbedTemplate, deleteEmbedTemplate,
  getChannelMultipliers, updateChannelMultipliers, getChannelMultiplier,
  getPointDecaySettings, updatePointDecaySettings,
} from './features.js'

// ポイント・経済・ガチャ・リワード
export {
  getGachaSettings, updateGachaSettings, rollGacha,
  getAllPointRules, updatePointRules,
  getAllRewards, createReward, updateReward, deleteReward,
  getOrCreateMember, addPoints, transferPoints, addVoiceMinutes,
  getLeaderboard, getUserRank, getTransactionHistory, getPointStats,
  getEconomySettings, updateEconomySettings, claimDaily, getDailyTransferTotal,
  resetAllPoints, resetUserPoints, purchaseReward, getDailyCpStats,
} from './points.js'

// RPランクシステム
export {
  getRankConfig, updateRankConfig, addRankTier, removeRankTier,
  getXRankConfig, updateXRankConfig,
  getRankSettings, updateRankSettings,
  getRpRules, updateRpRules, createRpRule, deleteRpRule,
  determineRank, getRankInfo, getMemberRank, addRp, getCpMultiplier,
  getDailyRpTotal,
  applyDecay, setDecayExempt, getDecayExemptMembers,
  getRpLeaderboard, getRpHistory,
  getSeasonConfig, updateSeasonConfig, getNextSeasonEnd,
  checkAndExecuteSeason, getSeasonHistory,
  cleanupOldRpTransactions, recalculateAllRanks,
  resetAllRanks, resetUserRank,
} from './rp-system.js'

// AI採点システム
export {
  getAiScoringSettings, updateAiScoringSettings,
  addScoringResult, getScoringHistory, getScoringStats,
  getDailyApiCount, getUserDailyScoringCount,
} from './ai-scoring.js'
