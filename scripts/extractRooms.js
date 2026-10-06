const fs = require('fs');
const path = require('path');

// ⚠️注意：根据你本地实际文件夹结构调整路径
const MAP_DIR = path.join(__dirname, '../d'); 
const OUTPUT_FILE = path.join(__dirname, '../data/rooms.json');

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else if (file.endsWith('.c')) {
            arrayOfFiles.push(path.join(dirPath, file));
        }
    });
    return arrayOfFiles;
}

const roomFiles = getAllFiles(MAP_DIR);
const roomsData = {};

roomFiles.forEach(filePath => {
    const iconv = require('iconv-lite'); // 在文件最顶部加上这一行
    // 原来的那行改成这样：
    const content = iconv.decode(fs.readFileSync(filePath), 'gbk');
    
    // 生成唯一ID，例如 "city/inn"
    const relativePath = path.relative(MAP_DIR, filePath).replace(/\\/g, '/').replace('.c', '');
    const roomDir = path.dirname(relativePath);

    // 1. 抓取房间名
    const shortMatch = content.match(/set\(\s*"short"\s*,\s*"([^"]+)"/);
    const shortName = shortMatch ? shortMatch[1] : '未知房间';

    // 2. 抓取房间描述
    const longMatch = content.match(/set\(\s*"long"\s*,\s*"([\s\S]*?)"\s*\)/);
    let longDesc = longMatch ? longMatch[1] : '没有描述。';
    longDesc = longDesc.replace(/\\n/g, '\n');

    // 3. 抓取出口
    const exitsMatch = content.match(/set\(\s*"exits"\s*,\s*\(\[\s*([\s\S]*?)\s*\]\)\s*\)/);
    const exits = {};
    if (exitsMatch) {
        const exitLines = exitsMatch[1].split(',');
        exitLines.forEach(line => {
            const match = line.match(/"([^"]+)"\s*:\s*(__DIR__\s*"?([^"]+)"?|"([^"]+)")/);
            if (match) {
                const dir = match[1];
                let target = match[3] || match[4];
                if (line.includes('__DIR__')) {
                    target = path.join(roomDir, target).replace(/\\/g, '/');
                } else {
                    target = target.replace(/^\/+/, ''); 
                }
                exits[dir] = target;
            }
        });
    }

    roomsData[relativePath] = {
        id: relativePath,
        name: shortName,
        description: longDesc,
        exits: exits
    };
});

if (!fs.existsSync(path.dirname(OUTPUT_FILE))){ fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true }); }
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(roomsData, null, 2), 'utf-8');
console.log(`✅ 提取成功！共提取 ${Object.keys(roomsData).length} 个房间，已保存至 data/rooms.json`);
