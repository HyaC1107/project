const socketIo = require('socket.io');

module.exports = (server) => {
    const io = socketIo(server, {
        cors: { 
            origin: "http://localhost:5500", 
            credentials: true 
        }
    });

    io.on('connection', (socket) => {
        // console.log('✅ 대시보드 브라우저 연결됨! ID:', socket.id);

        // 1. 프론트엔드에서 특정 기기 방에 입장하고 싶을 때 (serial_number 기준)
        socket.on('join_room', (serial_number) => {
            if (!serial_number) return;
            
            socket.join(serial_number); // 소켓 라이브러리의 방 입장 기능!
            // console.log(`👥 [Room Join] 기기 시리얼(${serial_number}) 방에 유저 입장!`);
        });

        // 2. 혹시나 프론트에서 명령을 보낼 때를 대비한 로그 (선택사항)
        socket.on('disconnect', () => {
            // console.log('❌ 브라우저 연결 종료');
        });
    });

    return io;
};