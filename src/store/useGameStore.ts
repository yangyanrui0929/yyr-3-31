import { create } from 'zustand';
import {
  GridCell,
  ToolType,
  GRID_SIZE,
  DAY_LENGTH,
  FAULT_CHANCE,
  BUILDING_STATS,
  DAY_THRESHOLD,
} from '../utils/constants';
import { calculatePowerNetwork, countPoweredBuildings } from '../utils/powerCalculator';

const STORAGE_KEY = 'floating-island-grid-game-save';
const BACKUPS_KEY = 'floating-island-grid-game-backups';
const MAX_BACKUPS = 5;

interface PersistedState {
  grid: GridCell[][];
  dayTime: number;
  storedPower: number;
  satisfaction: number;
  lastSavedAt: number;
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

interface GameState {
  grid: GridCell[][];
  dayTime: number;
  storedPower: number;
  maxStorage: number;
  satisfaction: number;
  selectedTool: ToolType;
  poweredCells: Set<string>;
  totalGeneration: number;
  totalConsumption: number;
  showSettlement: boolean;
  showSaveManagement: boolean;
  lastSavedAt: number;
  setSelectedTool: (tool: ToolType) => void;
  placeOrRemove: (x: number, y: number) => void;
  rotateCell: (x: number, y: number) => void;
  repairCell: (x: number, y: number) => void;
  tick: () => void;
  resetGame: () => void;
  openSettlement: () => void;
  closeSettlement: () => void;
  openSaveManagement: () => void;
  closeSaveManagement: () => void;
  saveBackup: (name?: string) => BackupSave | null;
  loadBackup: (id: string) => void;
  listBackups: () => BackupSave[];
  deleteBackup: (id: string) => void;
}

function createEmptyGrid(): GridCell[][] {
  const grid: GridCell[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push({
        x,
        y,
        type: 'empty',
        rotation: 0,
        powered: false,
        faulty: false,
      });
    }
    grid.push(row);
  }
  return grid;
}

function saveToLocalStorage(state: PersistedState): void {
  try {
    const data = JSON.stringify({
      grid: state.grid,
      dayTime: state.dayTime,
      storedPower: state.storedPower,
      satisfaction: state.satisfaction,
      lastSavedAt: state.lastSavedAt,
    });
    localStorage.setItem(STORAGE_KEY, data);
  } catch {
    // ignore storage errors
  }
}

function loadFromLocalStorage(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data.grid && Array.isArray(data.grid)) {
      return {
        grid: data.grid,
        dayTime: data.dayTime ?? 20,
        storedPower: data.storedPower ?? 10,
        satisfaction: data.satisfaction ?? 50,
        lastSavedAt: data.lastSavedAt ?? Date.now(),
      };
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function countBuildings(grid: GridCell[][]): number {
  let count = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[y][x].type !== 'empty') count++;
    }
  }
  return count;
}

function loadBackupsFromStorage(): BackupSave[] {
  try {
    const raw = localStorage.getItem(BACKUPS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
  } catch {
    // ignore parse errors
  }
  return [];
}

function saveBackupsToStorage(backups: BackupSave[]): void {
  try {
    localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
  } catch {
    // ignore storage errors
  }
}

function recalcGrid(grid: GridCell[][], dayTime: number, storedPower: number) {
  const { poweredCells, totalGeneration, totalConsumption, batteryCapacity } =
    calculatePowerNetwork(grid, dayTime, storedPower);

  const newGrid = grid.map((row) => row.map((c) => ({ ...c })));
  for (let yy = 0; yy < GRID_SIZE; yy++) {
    for (let xx = 0; xx < GRID_SIZE; xx++) {
      newGrid[yy][xx].powered = poweredCells.has(`${xx},${yy}`);
    }
  }

  return { newGrid, poweredCells, totalGeneration, totalConsumption, batteryCapacity };
}

function initGame(): Omit<GameState, keyof GameStateActions> {
  const saved = loadFromLocalStorage();
  const grid = saved ? saved.grid : createEmptyGrid();
  const dayTime = saved ? saved.dayTime : 20;
  const storedPower = saved ? saved.storedPower : 10;
  const satisfaction = saved ? saved.satisfaction : 50;
  const lastSavedAt = saved ? saved.lastSavedAt : Date.now();

  const { newGrid, poweredCells, totalGeneration, totalConsumption, batteryCapacity } =
    recalcGrid(grid, dayTime, storedPower);

  return {
    grid: newGrid,
    dayTime,
    storedPower,
    maxStorage: batteryCapacity,
    satisfaction,
    selectedTool: 'windmill',
    poweredCells,
    totalGeneration,
    totalConsumption,
    showSettlement: false,
    showSaveManagement: false,
    lastSavedAt,
  };
}

type GameStateActions = Pick<
  GameState,
  | 'setSelectedTool'
  | 'placeOrRemove'
  | 'rotateCell'
  | 'repairCell'
  | 'tick'
  | 'resetGame'
  | 'openSettlement'
  | 'closeSettlement'
  | 'openSaveManagement'
  | 'closeSaveManagement'
  | 'saveBackup'
  | 'loadBackup'
  | 'listBackups'
  | 'deleteBackup'
>;

export const useGameStore = create<GameState>((set, get) => ({
  ...initGame(),

  setSelectedTool: (tool) => set({ selectedTool: tool }),

  placeOrRemove: (x, y) => {
    const state = get();
    const newGrid = state.grid.map((row) => row.map((c) => ({ ...c })));
    const cell = newGrid[y][x];
    const tool = state.selectedTool;

    if (tool === 'remove') {
      if (cell.type !== 'empty') {
        newGrid[y][x] = {
          ...cell,
          type: 'empty',
          rotation: 0,
          powered: false,
          faulty: false,
        };
      }
    } else {
      newGrid[y][x] = {
        ...cell,
        type: tool,
        rotation: tool === 'wire' ? cell.rotation % 6 : 0,
        powered: false,
        faulty: false,
      };
    }

    const result = recalcGrid(newGrid, state.dayTime, state.storedPower);

    const nextState = {
      grid: result.newGrid,
      poweredCells: result.poweredCells,
      totalGeneration: result.totalGeneration,
      totalConsumption: result.totalConsumption,
      maxStorage: result.batteryCapacity,
    };

    const now = Date.now();
    saveToLocalStorage({
      grid: result.newGrid,
      dayTime: state.dayTime,
      storedPower: state.storedPower,
      satisfaction: state.satisfaction,
      lastSavedAt: now,
    });

    set({ ...nextState, lastSavedAt: now });
  },

  rotateCell: (x, y) => {
    const state = get();
    const cell = state.grid[y][x];
    if (cell.type !== 'wire') return;

    const newGrid = state.grid.map((row) => row.map((c) => ({ ...c })));
    newGrid[y][x].rotation = (cell.rotation + 1) % 6;

    const result = recalcGrid(newGrid, state.dayTime, state.storedPower);

    const nextState = {
      grid: result.newGrid,
      poweredCells: result.poweredCells,
      totalGeneration: result.totalGeneration,
      totalConsumption: result.totalConsumption,
      maxStorage: result.batteryCapacity,
    };

    const now = Date.now();
    saveToLocalStorage({
      grid: result.newGrid,
      dayTime: state.dayTime,
      storedPower: state.storedPower,
      satisfaction: state.satisfaction,
      lastSavedAt: now,
    });

    set({ ...nextState, lastSavedAt: now });
  },

  repairCell: (x, y) => {
    const state = get();
    const cell = state.grid[y][x];
    if (!cell.faulty) return;

    const newGrid = state.grid.map((row) => row.map((c) => ({ ...c })));
    newGrid[y][x].faulty = false;

    const result = recalcGrid(newGrid, state.dayTime, state.storedPower);

    const nextState = {
      grid: result.newGrid,
      poweredCells: result.poweredCells,
      totalGeneration: result.totalGeneration,
      totalConsumption: result.totalConsumption,
      maxStorage: result.batteryCapacity,
    };

    const now = Date.now();
    saveToLocalStorage({
      grid: result.newGrid,
      dayTime: state.dayTime,
      storedPower: state.storedPower,
      satisfaction: state.satisfaction,
      lastSavedAt: now,
    });

    set({ ...nextState, lastSavedAt: now });
  },

  tick: () => {
    const state = get();
    const newGrid = state.grid.map((row) => row.map((c) => ({ ...c })));

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = newGrid[y][x];
        if (cell.type !== 'empty' && !cell.faulty && Math.random() < FAULT_CHANCE) {
          newGrid[y][x].faulty = true;
        }
      }
    }

    const newDayTime = (state.dayTime + 0.5) % DAY_LENGTH;

    const { poweredCells, totalGeneration, totalConsumption, batteryCapacity } =
      calculatePowerNetwork(newGrid, newDayTime, state.storedPower);

    for (let yy = 0; yy < GRID_SIZE; yy++) {
      for (let xx = 0; xx < GRID_SIZE; xx++) {
        newGrid[yy][xx].powered = poweredCells.has(`${xx},${yy}`);
      }
    }

    const netPower = totalGeneration - totalConsumption;
    let newStoredPower = state.storedPower;
    const isDay = newDayTime < DAY_THRESHOLD;

    if (batteryCapacity > 0) {
      if (netPower > 0) {
        newStoredPower = Math.min(batteryCapacity, state.storedPower + netPower * 0.3);
      } else if (netPower < 0 && !isDay) {
        const deficit = -netPower;
        const discharge = Math.min(state.storedPower, deficit * 0.5);
        newStoredPower = Math.max(0, state.storedPower - discharge);
      }
    }

    const { houses, poweredHouses, factories, poweredFactories } = countPoweredBuildings(
      newGrid,
      poweredCells
    );
    const totalBuildings = houses + factories;
    const totalPowered = poweredHouses + poweredFactories;
    let coverage = totalBuildings > 0 ? totalPowered / totalBuildings : 1;

    let newSatisfaction = state.satisfaction;
    if (coverage >= 0.8) {
      newSatisfaction = Math.min(100, state.satisfaction + 0.2);
    } else if (coverage >= 0.5) {
      newSatisfaction = Math.min(100, state.satisfaction + 0.05);
    } else {
      newSatisfaction = Math.max(0, state.satisfaction - 0.3);
    }

    const now = Date.now();
    saveToLocalStorage({
      grid: newGrid,
      dayTime: newDayTime,
      storedPower: newStoredPower,
      satisfaction: newSatisfaction,
      lastSavedAt: now,
    });

    set({
      grid: newGrid,
      dayTime: newDayTime,
      storedPower: newStoredPower,
      maxStorage: batteryCapacity,
      satisfaction: newSatisfaction,
      poweredCells,
      totalGeneration,
      totalConsumption,
      lastSavedAt: now,
    });
  },

  resetGame: () => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = createEmptyGrid();
    const result = recalcGrid(fresh, 20, 10);
    const now = Date.now();
    set({
      grid: result.newGrid,
      dayTime: 20,
      storedPower: 10,
      maxStorage: result.batteryCapacity,
      satisfaction: 50,
      selectedTool: 'windmill',
      poweredCells: result.poweredCells,
      totalGeneration: result.totalGeneration,
      totalConsumption: result.totalConsumption,
      showSettlement: false,
      showSaveManagement: false,
      lastSavedAt: now,
    });
  },

  openSettlement: () => set({ showSettlement: true }),
  closeSettlement: () => set({ showSettlement: false }),

  openSaveManagement: () => set({ showSaveManagement: true }),
  closeSaveManagement: () => set({ showSaveManagement: false }),

  saveBackup: (name) => {
    const state = get();
    const backups = loadBackupsFromStorage();
    const buildingCount = countBuildings(state.grid);
    const now = Date.now();
    const backupName = name || `存档 ${backups.length + 1}`;

    const newBackup: BackupSave = {
      id: `backup-${now}-${Math.random().toString(36).slice(2, 8)}`,
      grid: state.grid.map((row) => row.map((c) => ({ ...c }))),
      dayTime: state.dayTime,
      storedPower: state.storedPower,
      satisfaction: state.satisfaction,
      buildingCount,
      savedAt: now,
      name: backupName,
    };

    backups.unshift(newBackup);
    const trimmed = backups.slice(0, MAX_BACKUPS);
    saveBackupsToStorage(trimmed);

    return newBackup;
  },

  loadBackup: (id) => {
    const backups = loadBackupsFromStorage();
    const backup = backups.find((b) => b.id === id);
    if (!backup) return;

    const result = recalcGrid(backup.grid, backup.dayTime, backup.storedPower);
    const now = Date.now();

    saveToLocalStorage({
      grid: result.newGrid,
      dayTime: backup.dayTime,
      storedPower: backup.storedPower,
      satisfaction: backup.satisfaction,
      lastSavedAt: now,
    });

    set({
      grid: result.newGrid,
      dayTime: backup.dayTime,
      storedPower: backup.storedPower,
      maxStorage: result.batteryCapacity,
      satisfaction: backup.satisfaction,
      poweredCells: result.poweredCells,
      totalGeneration: result.totalGeneration,
      totalConsumption: result.totalConsumption,
      lastSavedAt: now,
      showSaveManagement: false,
    });
  },

  listBackups: () => {
    return loadBackupsFromStorage();
  },

  deleteBackup: (id) => {
    const backups = loadBackupsFromStorage();
    const filtered = backups.filter((b) => b.id !== id);
    saveBackupsToStorage(filtered);
  },
}));
