const fs = require('fs');
const path = require('path');

// ⚠️ 注意路径：根据你实际存放物品的文件夹调整，通常是 'clone' 或者 'obj'
const ITEM_DIR = path.join(__dirname, '../clone'); 
const OUTPUT_FILE = path.join(__dirname, '../data/items.json');

// 递归读取所有 .c 文件
function getAllFiles(dirPath, arrayOfFiles) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles || [];
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

const itemFiles = getAllFiles(ITEM_DIR);
const itemsData = {};

itemFiles.forEach(filePath => {
    const iconv = require('iconv-lite'); // 在文件最顶部加上这一行
// 原来的那行改成这样：
    const content = iconv.decode(fs.readFileSync(filePath), 'gbk');
    
    // 唯一 ID（用相对路径）
    const relativePath = path.relative(ITEM_DIR, filePath).replace(/\\/g, '/').replace('.c', '');

    // 1. 提取名称 (set_name)
    const nameMatch = content.match(/set_name\s*\(\s*"([^"]+)"/);
    const itemName = nameMatch ? nameMatch[1] : '未知物品';

    // 2. 提取别名 (如 { "sword", "chang jian" })
    const aliasMatch = content.match(/set_name\s*\([^,]+,\s*\(\{([^}]+)\}\)\s*\)/);
    let aliases = [];
    if (aliasMatch) {
        aliases = aliasMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
    }

    // 3. 提取描述 (set("long"))
    const longMatch = content.match(/set\(\s*"long"\s*,\s*"([\s\S]*?)"\s*\)/);
    const itemDesc = longMatch ? longMatch[1] : '没有描述。';

    // 4. 提取通用属性（用通配符抓取所有 set("xxx", yyy)）
    const properties = {};
    const setRegex = /set\s*\(\s*"([^"]+)"\s*,\s*(.*?)\s*\)/g;
    let match;
    while ((match = setRegex.exec(content)) !== null) {
        const key = match[1];
        let value = match[2].trim();
        
        // 跳过我们单独处理的字段
        if (key === 'long' || key === 'name' || key === 'id') continue;

        // 去除字符串两端的引号，或者把数字转为数字类型
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        } else if (!isNaN(value)) {
            value = Number(value);
        }
        
        properties[key] = value;
    }

    itemsData[relativePath] = {
        id: relativePath,
        name: itemName,
        aliases: aliases,
        description: itemDesc,
        ...properties // 展开所有提取到的属性（damage, value, weight 等）
    };
});

if (!fs.existsSync(path.dirname(OUTPUT_FILE))){ fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true }); }
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(itemsData, null, 2), 'utf-8');
console.log(`✅ 提取成功！共提取 ${Object.keys(itemsData).length} 个物品，已保存至 data/items.json`);