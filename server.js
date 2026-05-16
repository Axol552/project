const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const io = new Server(PORT, { cors: { origin: "*" } });

let players = {};
let trackWidth = 10;
let spawnTimer = null;
let isRoundActive = true;

console.log(`Serwer Cyber-Arena działa na porcie ${PORT}...`);

function serverSpawnLoop() {
    if (!isRoundActive) return;

    if (Object.keys(players).length > 0) {
        const xPos = (Math.random() - 0.5) * (trackWidth - 3);
        const id = Math.random().toString(36).substring(2, 9);
        
        // Losowanie typu obiektu: Przeszkoda, Kryształ, Tarcza, Nitro
        const rand = Math.random();
        let type = 'crystal';
        let isMoving = false;

        if (rand > 0.4) {
            type = 'obstacle';
            isMoving = Math.random() > 0.5; // 50% szans, że przeszkoda będzie się ruszać
        } else if (rand < 0.1) {
            type = 'shield';
        } else if (rand >= 0.1 && rand < 0.2) {
            type = 'nitro';
        }

        const height = type === 'obstacle' ? (Math.random() * 2 + 2) : 0;

        io.emit("spawnObject", { id, type, xPos, height, isMoving });
    }
    
    spawnTimer = setTimeout(serverSpawnLoop, 1100);
}
serverSpawnLoop();

function resetRound() {
    clearTimeout(spawnTimer);
    isRoundActive = false;
    
    setTimeout(() => {
        isRoundActive = true;
        io.emit("startNewRound");
        serverSpawnLoop();
    }, 3000);
}

io.on("connection", (socket) => {
    console.log(`Gracz połączył się: ${socket.id}`);
    
    // Domyślny stan gracza z nickiem "Anonim"
    players[socket.id] = { x: 0, skin: 'default', score: 0, name: 'Anonim' };

    socket.emit("currentPlayers", players);

    // Kiedy gracz poda swój nick po wejściu na stronę
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
        console.log(`Gracz rozłączył się: ${socket.id}`);
        delete players[socket.id];
        io.emit("playerDisconnected", socket.id);
        io.emit("leaderboardUpdate", players);
    });
});
