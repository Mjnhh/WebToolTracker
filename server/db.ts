import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Lấy __dirname trong ES modules (vì __dirname không tồn tại trong ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE_PATH = path.join(__dirname, '../data/db.json');

// Đảm bảo thư mục data tồn tại
async function ensureDataDirExists() {
  const dataDir = path.dirname(DB_FILE_PATH);
  try {
    await fs.access(dataDir);
  } catch (error) {
    // Nếu thư mục không tồn tại, tạo nó
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Đảm bảo file DB tồn tại
async function ensureDbFileExists() {
  try {
    await fs.access(DB_FILE_PATH);
  } catch (error) {
    // Nếu file không tồn tại, tạo nó với dữ liệu trống
    await fs.writeFile(DB_FILE_PATH, JSON.stringify({}));
  }
}

// Đọc dữ liệu từ file DB
async function readDb() {
  await ensureDataDirExists();
  await ensureDbFileExists();
  
  const data = await fs.readFile(DB_FILE_PATH, 'utf-8');
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Lỗi khi parse dữ liệu DB:', error);
    return {};
  }
}

// Ghi dữ liệu vào file DB
async function writeDb(data: any) {
  await ensureDataDirExists();
  await fs.writeFile(DB_FILE_PATH, JSON.stringify(data, null, 2));
}

export const db = {
  read: readDb,
  write: async (updateFn: (data: any) => Promise<void> | void) => {
    const data = await readDb();
    await updateFn(data);
    await writeDb(data);
  }
}; 