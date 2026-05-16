const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const io = new Server(PORT, { cors: { origin: "*" } });

let players = {};
let trackWidth = 10;

console.log(`Serwer Multiplayer działa na porcie ${PORT}...`);

// --- PĘTLA GENEROWANIA PRZESZKÓD NA SERWERZE ---
function serverSpawnLoop() {
    // Generuj obiekty tylko, gdy na serwerze jest chociaż jeden gracz
    if (Object.keys(players).length > 0) {
        const xPos = (Math.random() - 0.5) * (trackWidth - 3);
        const type = Math.random() > 0.4 ? 'obstacle' : 'crystal';
        const id = Math.random().toString(36).substring(2, 9); // Unikalne ID obiektu
        const height = Math.random() * 2 + 2; // Wysokość jeśli to przeszkoda

        // Wysyłamy info o nowym obiekcie DO WSZYSTKICH
        io.emit("spawnObject", { id, type, xPos, height });
    }
    
    // Serwer decyduje o czasie kolejnego spawnu (np. co 1.2 sekundy)
    setTimeout(serverSpawnLoop, 1200);
}
serverSpawnLoop();

io.on("connection", (socket) => {
    console.log(`Gracz połączył się: ${socket.id}`);
    
    players[socket.id] = { x: 0, skin: 'default' };

    socket.emit("currentPlayers", players);
    socket.broadcast.emit("newPlayer", { id: socket.id, playerInfo: players[socket.id] });

    socket.on("playerMovement", (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            socket.broadcast.emit("playerMoved", { id: socket.id, x: movementData.x });
        }
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
