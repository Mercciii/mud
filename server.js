const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// 1. 加载地图数据 (确保 rooms.json 在 data 文件夹里)
const roomsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/rooms.json'), 'utf-8'));

// 2. 初始化 Web 服务器
const app = express();
app.use(express.static('public')); // 将 public 文件夹作为静态网页目录
const server = http.createServer(app);

// 3. 初始化 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 4. 简单的内存玩家状态 (正式版应使用 MongoDB/Redis)
const players = {}; 

wss.on('connection', (ws) => {
    // 生成一个随机玩家 ID
    const playerId = Math.random().toString(36).substring(2, 9);
    // 默认出生点（请确保 roomsData 里有这个房间，比如 'd/city/inn'）
    const startRoomId = Object.keys(roomsData)[0] || 'default'; 
    
    players[playerId] = {
    ws: ws,
    currentRoomId: startRoomId,
    name: "无名侠客",
    hp: 100, maxHp: 100,
    mp: 50, maxMp: 50
};

    console.log(`玩家 ${playerId} 上线了。`);
   ws.send(JSON.stringify({ type: 'text', content: '欢迎来到现代版 HTML MUD！\n输入 look 查看周围，输入 north/south/east/west 移动。\n' }));
   sendStatus(players[playerId]); // 通知前端初始血量

    // 触发一次初始 look
    handleCommand(playerId, 'look');

    // 接收前端发来的指令
    ws.on('message', (message) => {
        const command = message.toString().trim().toLowerCase();
        handleCommand(playerId, command);
    });

    // 玩家掉线处理
    ws.on('close', () => {
        console.log(`玩家 ${playerId} 下线了。`);
        delete players[playerId];
    });
});

// 新增一个发送状态的函数
function sendStatus(player) {
    player.ws.send(JSON.stringify({
        type: 'status',
        hp: player.hp,
        maxHp: player.maxHp,
        mp: player.mp,
        maxMp: player.maxMp
    }));
}

function handleCommand(playerId, command) {
    const player = players[playerId];
    if (!player) return;
    
    const room = roomsData[player.currentRoomId];
    if (!room) {
        player.ws.send(JSON.stringify({ type: 'text', content: "错误：你身处一片虚空之中，数据加载失败。" }));
        return;
    }

    // 发送状态（每次指令都更新一次，让前端血条动起来）
    sendStatus(player);

    // 1. 查看指令 (look)
    if (command === 'look' || command === 'l') {
        let text = `\n【${room.name}】\n${room.description}`;
        const exits = Object.keys(room.exits || {}).join('、');
        text += `\n\n明显的出口：${exits || '无'}`;
        player.ws.send(JSON.stringify({ type: 'text', content: text }));
        return;
    }

    // 2. 移动指令
    if (room.exits && room.exits[command]) {
        const targetRoomId = room.exits[command];
        player.currentRoomId = targetRoomId;
        player.ws.send(JSON.stringify({ type: 'text', content: `\n你向 ${command} 走去...` }));
        handleCommand(playerId, 'look'); // 移动后自动 look
        return;
    }

    // 3. 未知指令
    player.ws.send(JSON.stringify({ type: 'text', content: `这里没有方向叫做 "${command}"，或者你输入了未知指令。` }));
}

// 5. 启动服务器
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 MUD 服务器已启动!`);
    console.log(`🌍 网页访问地址: http://localhost:${PORT}`);
    console.log(`🔗 WebSocket 地址: ws://localhost:${PORT}`);
    console.log(`=========================================`);
});