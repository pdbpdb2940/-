import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const DATA_DIR = path.join(currentDir, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const DEFAULT_STAFF_LIST = [
  {
    id: 'staff-1',
    name: '神谷',
    colorBg: 'bg-emerald-50',
    colorText: 'text-emerald-900',
    colorBorder: 'border-emerald-300',
  },
  {
    id: 'staff-2',
    name: '紙谷',
    colorBg: 'bg-indigo-50',
    colorText: 'text-indigo-900',
    colorBorder: 'border-indigo-300',
  },
  {
    id: 'staff-3',
    name: '中野',
    colorBg: 'bg-amber-50',
    colorText: 'text-amber-900',
    colorBorder: 'border-amber-300',
  },
];

interface AppData {
  shifts: any[];
  staffList: any[];
  tasks: any[];
  notes: Record<string, string>;
  adminPin: string;
  auditLogs: any[];
  updatedAt: number;
}

function getDefaultData(): AppData {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const mStr = String(month).padStart(2, '0');

  const initialShifts = [
    {
      id: 'sample-1',
      date: `${year}-${mStr}-03`,
      staffName: '神谷',
      startTime: '07:30',
      endTime: '16:15',
      note: '定例巡回',
      createdAt: Date.now() - 300000,
    },
    {
      id: 'sample-2',
      date: `${year}-${mStr}-05`,
      staffName: '紙谷',
      startTime: '07:30',
      endTime: '16:15',
      note: '設備点検',
      createdAt: Date.now() - 200000,
    },
    {
      id: 'sample-3',
      date: `${year}-${mStr}-10`,
      staffName: '中野',
      startTime: '07:30',
      endTime: '16:15',
      note: '設備巡回',
      createdAt: Date.now() - 100000,
    },
    {
      id: 'sample-4',
      date: `${year}-${mStr}-16`,
      staffName: '神谷',
      startTime: '07:30',
      endTime: '16:15',
      note: '',
      createdAt: Date.now() - 50000,
    },
  ];

  return {
    shifts: initialShifts,
    staffList: DEFAULT_STAFF_LIST,
    tasks: [],
    notes: {},
    adminPin: '7322',
    auditLogs: [],
    updatedAt: Date.now(),
  };
}

function readData(): AppData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const initial = getDefaultData();
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const normalizedShifts = Array.isArray(parsed.shifts)
      ? parsed.shifts.map((s: any) => {
          const isAbs = Boolean(s.isAbsence) || s.startTime === '終日' || !s.endTime || Boolean(s.absenceType);
          const absenceType = s.absenceType || (isAbs ? (s.note?.includes('出張') ? '出張' : s.note?.includes('研修') ? '研修' : '休み') : undefined);
          return {
            ...s,
            isAbsence: isAbs,
            absenceType,
          };
        })
      : [];

    return {
      shifts: normalizedShifts,
      staffList: Array.isArray(parsed.staffList) && parsed.staffList.length > 0 ? parsed.staffList : DEFAULT_STAFF_LIST,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      notes: typeof parsed.notes === 'object' && parsed.notes !== null ? parsed.notes : {},
      adminPin: parsed.adminPin || '7322',
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch (err) {
    console.error('Error reading data file:', err);
    return getDefaultData();
  }
}

function writeData(data: Partial<AppData>): AppData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const current = readData();
    const updated: AppData = {
      shifts: data.shifts !== undefined ? data.shifts : current.shifts,
      staffList: data.staffList !== undefined ? data.staffList : current.staffList,
      tasks: data.tasks !== undefined ? data.tasks : current.tasks,
      notes: data.notes !== undefined ? { ...current.notes, ...data.notes } : current.notes,
      adminPin: data.adminPin !== undefined ? data.adminPin : current.adminPin,
      auditLogs: data.auditLogs !== undefined ? data.auditLogs : current.auditLogs,
      updatedAt: Date.now(),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    console.error('Error writing data file:', err);
    return readData();
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // APIルート
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 全データ取得
  app.get('/api/data', (req, res) => {
    const data = readData();
    res.json(data);
  });

  // フル同期（クライアントデータとサーバーデータを統合）
  app.post('/api/sync', (req, res) => {
    const { shifts, staffList, tasks, notes, adminPin, auditLogs } = req.body;
    const current = readData();

    const newShifts = Array.isArray(shifts) && shifts.length > 0 ? shifts : current.shifts;
    const newStaff = Array.isArray(staffList) && staffList.length > 0 ? staffList : current.staffList;
    const newTasks = Array.isArray(tasks) ? tasks : current.tasks;
    const newNotes = notes ? { ...current.notes, ...notes } : current.notes;
    const newPin = adminPin || current.adminPin;
    const newAuditLogs = Array.isArray(auditLogs) ? auditLogs : current.auditLogs;

    const saved = writeData({
      shifts: newShifts,
      staffList: newStaff,
      tasks: newTasks,
      notes: newNotes,
      adminPin: newPin,
      auditLogs: newAuditLogs,
    });
    res.json(saved);
  });

  // シフト一括更新
  app.post('/api/shifts', (req, res) => {
    const { shifts } = req.body;
    if (!Array.isArray(shifts)) {
      return res.status(400).json({ error: 'shifts must be an array' });
    }
    const saved = writeData({ shifts });
    res.json({ success: true, shifts: saved.shifts, updatedAt: saved.updatedAt });
  });

  // 業務予定更新
  app.get('/api/tasks', (req, res) => {
    const data = readData();
    res.json(data.tasks);
  });

  app.post('/api/tasks', (req, res) => {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'tasks must be an array' });
    }
    const saved = writeData({ tasks });
    res.json({ success: true, tasks: saved.tasks, updatedAt: saved.updatedAt });
  });

  // 職員リスト更新
  app.post('/api/staff', (req, res) => {
    const { staffList } = req.body;
    if (!Array.isArray(staffList)) {
      return res.status(400).json({ error: 'staffList must be an array' });
    }
    const saved = writeData({ staffList });
    res.json({ success: true, staffList: saved.staffList, updatedAt: saved.updatedAt });
  });

  // メモ更新
  app.post('/api/notes', (req, res) => {
    const { key, note } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    const current = readData();
    const updatedNotes = { ...current.notes, [key]: String(note || '') };
    const saved = writeData({ notes: updatedNotes });
    res.json({ success: true, notes: saved.notes, updatedAt: saved.updatedAt });
  });

  // 監査ログ
  app.get('/api/audit-logs', (req, res) => {
    const data = readData();
    res.json(data.auditLogs);
  });

  app.post('/api/audit-logs', (req, res) => {
    const { log } = req.body;
    if (!log) {
      return res.status(400).json({ error: 'log is required' });
    }
    const current = readData();
    const logs = [log, ...current.auditLogs].slice(0, 500);
    const saved = writeData({ auditLogs: logs });
    res.json({ success: true, auditLogs: saved.auditLogs });
  });

  // 暗証番号更新
  app.post('/api/admin-pin', (req, res) => {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'pin is required' });
    }
    const saved = writeData({ adminPin: String(pin) });
    res.json({ success: true, adminPin: saved.adminPin });
  });

  // Vite middleware setup (Express v4: app.get('*', ...))
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
