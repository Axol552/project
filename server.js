const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const io = new Server(PORT, { cors: { origin: "*" } });

let players = {};
let trackWidth = 10;
let spawnTimer = null;
let isRoundActive = true;

console.log(`Serwer Rywalizacji działa na porcie ${PORT}...`);

function serverSpawnLoop() {
    if (!isRoundActive) return;

    if (Object.keys(players).length > 0) {
        const xPos = (Math.random() - 0.5) * (trackWidth - 3);
        const type = Math.random() > 0.4 ? 'obstacle' : 'crystal';
        const id = Math.random().toString(36).substring(2, 9);
        const height = Math.random() * 2 + 2;

        io.emit("spawnObject", { id, type, xPos, height });
    }
    
    // Zapisujemy timer, żeby móc go zatrzymać przy restarcie
    spawnTimer = setTimeout(serverSpawnLoop, 1200);
}
serverSpawnLoop();

// Funkcja restartująca rundę na serwerze
function resetRound() {
    clearTimeout(spawnTimer);
    isRoundActive = false;
    
    // Dajemy graczom 3 sekundy przerwy przed nową rundą
    setTimeout(() => {
        isRoundActive = true;
        io.emit("startNewRound");
        serverSpawnLoop();
    }, 3000);
}

io.on("connection", (socket) => {
    console.log(`Gracz połączył się: ${socket.id}`);
    
    // Każdy nowy gracz startuje z wynikiem 0
    players[socket.id] = { x: 0, skin: 'default', score: 0 };

    socket.emit("currentPlayers", players);
    socket.broadcast.emit("newPlayer", { id: socket.id, playerInfo: players[socket.id] });

    socket.on("playerMovement", (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            socket.broadcast.emit("playerMoved", { id: socket.id, x: movementData.x });
        }
    });

    // 💀 OBSŁUGA ŚMIERCI GRACZA 💀
    socket.on("playerDied", () => {
        if (!isRoundActive) return; // Zabezpieczenie przed podwójnym naliczeniem

        console.log(`Gracz ${socket.id} uderzył w przeszkodę!`);
        
        // Szukamy drugiego gracza i dodajemy mu punkt
        Object.keys(players).forEach((id) => {
            if (id !== socket.id) {
                players[id].score += 1;
            }
        });

        // Wysyłamy do wszystkich informację o nowej punktacji i o tym, kto przegrał ruszającą rundę
        io.emit("roundOver", { 
            loserId: socket.id, 
            playersStatus: players 
        });

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
    });
});
