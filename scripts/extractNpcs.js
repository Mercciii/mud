const fs = require('fs');
const path = require('path');

// ⚠️ 注意：NPC可能在 'd' 或 'npc' 文件夹里。如果路径不对，请修改这里。
const NPC_DIR = path.join(__dirname, '../d'); 
const OUTPUT_FILE = path.join(__dirname, '../data/npcs.json');

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

const npcFiles = getAllFiles(NPC_DIR);
const npcsData = {};

npcFiles.forEach(filePath => {
    const iconv = require('iconv-lite'); // 在文件最顶部加上这一行
// 原来的那行改成这样：
    const content = iconv.decode(fs.readFileSync(filePath), 'gbk');
    
    // ⚠️ 核心判断：只有包含 "inherit NPC" 或 "set("max_hp")" 的文件才是 NPC
    if (!content.includes('inherit NPC') && !content.includes('set("max_hp"') && !content.includes('set("combat_exp"')) return;

    const relativePath = path.relative(NPC_DIR, filePath).replace(/\\/g, '/').replace('.c', '');

    // 1. 提取名称
    const nameMatch = content.match(/set_name\s*\(\s*"([^"]+)"/);
    const npcName = nameMatch ? nameMatch[1] : '未知NPC';

    // 2. 提取描述
    const longMatch = content.match(/set\(\s*"long"\s*,\s*"([\s\S]*?)"\s*\)/);
    const npcDesc = longMatch ? longMatch[1] : '没有描述。';

    // 3. 提取属性 (HP, 攻击, 经验等)
    const properties = {};
    const setRegex = /set\s*\(\s*"([^"]+)"\s*,\s*(.*?)\s*\)/g;
    let match;
    while ((match = setRegex.exec(content)) !== null) {
        const key = match[1];
        let value = match[2].trim();
        if (key === 'long' || key === 'name' || key === 'id') continue;
        
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (!isNaN(value)) value = Number(value);
        
        properties[key] = value;
    }

    // 4. 提取技能 (set_skill("sword", 50))
    const skills = {};
    const skillRegex = /set_skill\s*\(\s*"([^"]+)"\s*,\s*(\d+)\s*\)/g;
    while ((match = skillRegex.exec(content)) !== null) {
        skills[match[1]] = Number(match[2]);
    }

    // 5. 提取掉落物/携带物品 (carry_object)
    const drops = [];
    const dropRegex = /carry_object\s*\(\s*([^)]+)\)/g;
    while ((match = dropRegex.exec(content)) !== null) {
        drops.push(match[1].replace(/__DIR__\s*"?/g, '').replace(/"/g, '').trim());
    }

    npcsData[relativePath] = {
        id: relativePath,
        name: npcName,
        description: npcDesc,
        skills: skills,
        drops: drops,
        ...properties
    };
});

if (!fs.existsSync(path.dirname(OUTPUT_FILE))){ fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true }); }
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(npcsData, null, 2), 'utf-8');
console.log(`✅ 提取成功！共提取 ${Object.keys(npcsData).length} 个 NPC，已保存至 data/npcs.json`);