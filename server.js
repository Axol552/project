const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const io = new Server(PORT, { cors: { origin: "*" } });

let players = {};
let trackWidth = 10;
let spawnTimer = null;
let isRoundActive = true;
let spawnInterval = 1100; // Bazowy czas spawnu
let roundTime = 0;
let roundTimerInterval = null;

console.log(`Serwer Cyber-Arena v2 działa na porcie ${PORT}...`);

function serverSpawnLoop() {
    if (!isRoundActive) return;

    if (Object.keys(players).length > 0) {
        const xPos = (Math.random() - 0.5) * (trackWidth - 3);
        const id = Math.random().toString(36).substring(2, 9);
        
        const rand = Math.random();
        let type = 'crystal';
        let isMoving = false;

        if (rand > 0.4) {
            type = 'obstacle';
            isMoving = Math.random() > 0.5;
        } else if (rand < 0.1) {
            type = 'shield';
        } else if (rand >= 0.1 && rand < 0.2) {
            type = 'nitro';
        }

        const height = type === 'obstacle' ? (Math.random() * 2 + 2) : 0;

        io.emit("spawnObject", { id, type, xPos, height, isMoving });
    }
    
    spawnTimer = setTimeout(serverSpawnLoop, spawnInterval);
}
serverSpawnLoop();

function resetRound() {
    clearTimeout(spawnTimer);
    clearInterval(roundTimerInterval);
    isRoundActive = false;
    spawnInterval = 1100; // Reset czasu spawnu
    roundTime = 0;
    
    setTimeout(() => {
        isRoundActive = true;
        io.emit("startNewRound");
        startRoundTimer();
        serverSpawnLoop();
    }, 3000);
}

function startRoundTimer() {
    roundTimerInterval = setInterval(() => {
        if (!isRoundActive) return;
        roundTime++;
        
        // 🚨 SUDDEN DEATH po 60 sekundach 🚨
        if (roundTime === 60) {
            spawnInterval = 500; // Spawn przeszkód dwa razy szybciej!
            io.emit("suddenDeath");
        }
    }, 1000);
}
startRoundTimer();

io.on("connection", (socket) => {
    players[socket.id] = { x: 0, skin: 'default', score: 0, name: 'Anonim' };
    socket.emit("currentPlayers", players);

    socket.on("joinGame", (data) => {
        if (players[socket.id]) {
            players[socket.id].name = data.name || 'Gracz';
            io.emit("leaderboardUpdate", players);
            socket.broadcast.emit("newPlayer", { id: socket.id, playerInfo: players[socket.id] });
        }
    });

    socket.on("playerMovement", (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            socket.broadcast.emit("playerMoved", { id: socket.id, x: movementData.x });
        }
    });

    // 💬 OBSŁUGA SZYBKIEGO CZATU 💬
    socket.on("sendMessage", (text) => {
        if (players[socket.id]) {
            io.emit("chatMessage", { id: socket.id, text: text });
        }
    });

    socket.on("playerDied", () => {
        if (!isRoundActive) return;
        Object.keys(players).forEach((id) => {
            if (id !== socket.id) players[id].score += 1;
        });
        io.emit("roundOver", { loserId: socket.id, playersStatus: players });
        resetRound();
    });

    socket.on("skinChanged", (skinName) => {
        if (players[socket.id]) {
            players[socket.id].skin = skinName;
            socket.broadcast.emit("playerSkinChanged", { id: socket.id, skin: skinName });
        }
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        io.emit("playerDisconnected", socket.id);
        io.emit("leaderboardUpdate", players);
    });
});
