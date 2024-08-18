const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Y = require('yjs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// 确保 CORS 允许来自前端的连接
app.use(cors({ origin: 'http://localhost:3000' }));

const io = socketIo(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket'],  // 强制使用 WebSocket 传输
});

// 创建 Yjs 文档并设置默认内容
const ydoc = new Y.Doc();
const yText = ydoc.getText('document');

// 初始化文档内容（仅在文档为空时设置）
if (yText.length === 0) {
    const initialContent = JSON.stringify({
        root: {
            children: [
                {
                    type: 'paragraph',
                    children: [
                        { type: 'text', text: 'hello' }
                    ]
                }
            ],
            type: 'root',
        }
    });
    yText.insert(0, initialContent);
}

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // 向新连接的客户端发送当前文档的状态
    const update = Y.encodeStateAsUpdate(ydoc);
    socket.emit('sync-update', update);

    // 监听客户端的更新
    socket.on('update', (clientUpdate) => {
        console.log('Received update from client:', clientUpdate);
        Y.applyUpdate(ydoc, new Uint8Array(clientUpdate));

        // 广播更新给其他客户端
        socket.broadcast.emit('update', clientUpdate);
    });

    socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', socket.id, 'Reason:', reason);
    });

    socket.on('connect_error', (err) => {
        console.error('Connection error:', err);
    });
});

server.listen(3001, () => {
    console.log('Server is running on port 3001');
});
