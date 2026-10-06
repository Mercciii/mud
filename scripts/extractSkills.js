const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.join(__dirname, '../kungfu'); 
const OUTPUT_FILE = path.join(__dirname, '../data/skills.json');

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

const skillFiles = getAllFiles(SKILL_DIR);
const skillsData = {};

skillFiles.forEach(filePath => {
    const iconv = require('iconv-lite'); // 在文件最顶部加上这一行
// 原来的那行改成这样：
    const content = iconv.decode(fs.readFileSync(filePath), 'gbk');
    const relativePath = path.relative(SKILL_DIR, filePath).replace(/\\/g, '/').replace('.c', '');

    // 尝试推断技能类型（通过文件夹名，如 sword, blade, force, dodge）
    const skillType = relativePath.split('/')[0] || 'unknown'; 

    // 1. 提取名称
    const nameMatch = content.match(/set_name\s*\(\s*"([^"]+)"/);
    const skillName = nameMatch ? nameMatch[1] : '未知技能';

    // 2. 提取描述
    const longMatch = content.match(/set\(\s*"long"\s*,\s*"([\s\S]*?)"\s*\)/);
    const skillDesc = longMatch ? longMatch[1] : '没有描述。';

    // 3. 提取基础属性 (消耗、等级上限等)
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

    skillsData[relativePath] = {
        id: relativePath,
        name: skillName,
        type: skillType,
        description: skillDesc,
        ...properties
    };
});

if (!fs.existsSync(path.dirname(OUTPUT_FILE))){ fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true }); }
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(skillsData, null, 2), 'utf-8');
console.log(`✅ 提取成功！共提取 ${Object.keys(skillsData).length} 个技能，已保存至 data/skills.json`);