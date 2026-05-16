const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

let players = {};

io.on('connection', (socket) => {
    console.log(`Gracz połączony: ${socket.id}`);

    // Rejestracja nowego gracza na mapie (odradzanie w losowym miejscu)
    players[socket.id] = {
        id: socket.id,
        name: "Rekrut",
        x: Math.random() * 20 - 10,
        y: 1.0, // Wysokość oczu gracza
        z: Math.random() * 20 - 10,
        rx: 0, ry: 0, // Rotacja myszki (góra/dół, lewo/prawo)
        hp: 100,
        frags: 0
    };

    // Wysyłamy nowemu graczowi listę obecnych, a innym info o nowym
    socket.emit('init', { id: socket.id, players });
    socket.broadcast.emit('playerJoined', players[socket.id]);

    // Aktualizacja pozycji i rotacji z klienta
    socket.on('updatePosition', (data) => {
        if (players[socket.id] && players[socket.id].hp > 0) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].rx = data.rx;
            players[socket.id].ry = data.ry;
            
            // Rozsyłamy pozycję do reszty (oprócz nadawcy)
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Logika strzału (Raycasting weryfikowany uproszczonym algorytmem na serwerze)
    socket.on('shoot', (data) => {
        if (!players[socket.id] || players[socket.id].hp <= 0) return;

        // Rozsyłamy efekt wizualny strzału do wszystkich
        io.emit('visualShot', { shooterId: socket.id, targetPoint: data.targetPoint });

        // Proste sprawdzanie trafienia na serwerze (hitbox jako odległość od linii strzału)
        // W profesjonalnych grach używa się pełnego 3D raycastingu na serwerze, 
        // tutaj robimy wersję zoptymalizowaną:
        Object.keys(players).forEach(targetId => {
            if (targetId === socket.id || players[targetId].hp <= 0) return;

            let target = players[targetId];
            // Obliczamy dystans od gracza do punktu, w który uderzył promień klienta
            let distToHit = Math.hypot(target.x - data.targetPoint.x, target.z - data.targetPoint.z);
            
            // Jeśli punkt trafienia jest bardzo blisko pozycji wroga - mamy HIT!
            if (distToHit < 1.5) { 
                target.hp -= 35; // Trzy strzały do eliminacji
                
                if (target.hp <= 0) {
                    players[socket.id].frags += 1;
                    io.emit('playerKilled', { victimId: targetId, killerId: socket.id, killerFrags: players[socket.id].frags });
                    
                    // Odrodzenie (Respawn) po 3 sekundach
                    setTimeout(() => {
                        if (players[targetId]) {
                            players[targetId].hp = 100;
                            players[targetId].x = Math.random() * 20 - 10;
                            players[targetId].z = Math.random() * 20 - 10;
                            io.emit('playerRespawned', players[targetId]);
                        }
                    }, 3000);
                } else {
                    io.emit('playerHit', { id: targetId, hp: target.hp });
                }
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`Gracz rozłączony: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serwer FPS działa na porcie ${PORT}`);
});
