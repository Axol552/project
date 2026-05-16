const { Server } = require("socket.io");

// Railway automatycznie podaje odpowiedni port w process.env.PORT
const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
    cors: {
        origin: "*", // Zezwalamy na łączenie się z dowolnego adresu (np. Twojego dysku lokalnego)
    }
});

let players = {};

console.log(`Serwer Multiplayer uruchomiony na porcie ${PORT}...`);

io.on("connection", (socket) => {
    console.log(`Gracz połączył się: ${socket.id}`);

    players[socket.id] = {
        x: 0,
        skin: 'default'
    };

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