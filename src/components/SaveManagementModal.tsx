import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { GRID_SIZE, GridCell } from '../utils/constants';
import { X, Save, Trash2, RotateCcw, Play, Archive } from 'lucide-react';

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

interface BackupSave {
  id: string;
  grid: GridCell[][];
  dayTime: number;
  storedPower: number;
  satisfaction: number;
  buildingCount: number;
  savedAt: number;
  name: string;
}

export const SaveManagementModal: React.FC = () => {
  const {
    showSaveManagement,
    closeSaveManagement,
    grid,
    satisfaction,
    storedPower,
    maxStorage,
    lastSavedAt,
    resetGame,
    saveBackup,
    loadBackup,
    listBackups,
    deleteBackup,
  } = useGameStore();

  const [backups, setBackups] = useState<BackupSave[]>([]);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  useEffect(() => {
    if (showSaveManagement) {
      setBackups(listBackups());
      setShowConfirmReset(false);
    }
  }, [showSaveManagement, listBackups]);

  if (!showSaveManagement) return null;

  let buildingCount = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[y][x].type !== 'empty') buildingCount++;
    }
  }

  const handleSaveBackup = () => {
    const backupName = `存档 ${backups.length + 1}`;
    saveBackup(backupName);
    setBackups(listBackups());
  };

  const handleLoadBackup = (id: string) => {
    loadBackup(id);
  };

  const handleDeleteBackup = (id: string) => {
    deleteBackup(id);
    setBackups(listBackups());
  };

  const handleResetConfirm = () => {
    resetGame();
  };

  const handleContinue = () => {
    closeSaveManagement();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={closeSaveManagement}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-[scaleIn_0.3s_ease-out] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white relative">
          <button
            onClick={closeSaveManagement}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-2xl font-bold">💾 存档管理</h2>
          <p className="text-amber-100 text-sm mt-1">管理你的浮岛进度存档</p>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Save className="w-4 h-4 text-blue-500" />
              当前存档
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/80 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">建筑数量</p>
                <p className="text-xl font-bold text-gray-800">{buildingCount} 座</p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">满意度</p>
                <p className="text-xl font-bold text-green-600">{Math.round(satisfaction)}%</p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">蓄电量</p>
                <p className="text-xl font-bold text-amber-600">
                  {Math.round(storedPower)}/{maxStorage}
                </p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">最近保存</p>
                <p className="text-sm font-semibold text-gray-700">
                  {formatDateTime(lastSavedAt)}
                </p>
              </div>
            </div>

            {!showConfirmReset ? (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleContinue}
                  className="flex flex-col items-center gap-1 py-3 px-2 bg-gradient-to-br from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white rounded-xl font-semibold text-xs shadow-lg transition-all duration-200 hover:scale-105"
                >
                  <Play className="w-4 h-4" />
                  继续当前
                </button>
                <button
                  onClick={handleSaveBackup}
                  disabled={backups.length >= 5}
                  className="flex flex-col items-center gap-1 py-3 px-2 bg-gradient-to-br from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl font-semibold text-xs shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <Archive className="w-4 h-4" />
                  另存为备份
                </button>
                <button
                  onClick={() => setShowConfirmReset(true)}
                  className="flex flex-col items-center gap-1 py-3 px-2 bg-gradient-to-br from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-semibold text-xs shadow-lg transition-all duration-200 hover:scale-105"
                >
                  <RotateCcw className="w-4 h-4" />
                  确认清空
                </button>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-semibold mb-3 text-center">
                  ⚠️ 确定要清空当前存档吗？此操作不可撤销！
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowConfirmReset(false)}
                    className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-sm transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleResetConfirm}
                    className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition-colors"
                  >
                    确认清空
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Archive className="w-4 h-4 text-amber-500" />
              备份存档 ({backups.length}/5)
            </h3>
            {backups.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-100">
                <p className="text-gray-400 text-sm">暂无备份存档</p>
                <p className="text-gray-400 text-xs mt-1">点击上方「另存为备份」保存当前进度</p>
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    className="bg-gray-50 hover:bg-gray-100 rounded-xl p-3 border border-gray-100 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{backup.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>🏗️ {backup.buildingCount} 座</span>
                          <span>😊 {Math.round(backup.satisfaction)}%</span>
                          <span>🔋 {Math.round(backup.storedPower)}</span>
                          <span>🕐 {formatDateTime(backup.savedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleLoadBackup(backup.id)}
                          className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"
                          title="恢复此备份"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.id)}
                          className="p-2 text-red-400 hover:bg-red-100 rounded-lg transition-colors"
                          title="删除此备份"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
