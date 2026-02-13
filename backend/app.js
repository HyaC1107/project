const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const path = require('path');

const db = require('./config/db'); 
require('./config/passport');
const socketInit = require('./sockets');
const NotificationService = require('./services/notificationService');
// 환경변수 설정 (.env 파일 활용 예정)
dotenv.config();
const PORT = process.env.PORT;

const app = express();
const server = http.createServer(app);

const io = socketInit(server);
app.set('io', io);

const notificationService = new NotificationService(io, db);
app.set('notificationService', notificationService);
const allowedOrigins = ['http://localhost:5500', 'http://127.0.0.1:5500'];
const corsOptions = {
    origin:  function(origin, callback) {
        if (!origin) return callback(null, true);  // Postman 등 서버 직접 호출 허용
        if (allowedOrigins.includes(origin)) {
        callback(null, true);
        } else {
        callback(new Error('Not allowed by CORS'));
        }
    }, 
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};


// 1. 미들웨어 설정
app.use(cors(corsOptions)); 
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,    // HTTP 환경이므로 반드시 false
        httpOnly: true,        
        maxAge: 1000 * 60 * 60 * 24, // 1일 유지
        sameSite: 'lax' 
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// 2. 라우트(Route) 연결
const sensorRouter = require('./routes/sensors');
const actuatorRouter = require('./routes/actuators');
const moduleRouter = require('./routes/modules');
const authRouter = require('./routes/auth');
const aiRouter = require('./routes/ai');
const weatherRouter = require('./routes/weather');
const notificationRouter = require('./routes/notifications');

app.use('/api/auth', authRouter);   // 소셜로그인
app.use('/api/modules', moduleRouter);  // 기기연동
app.use('/api/sensors', sensorRouter);
app.use('/api/actuators', actuatorRouter);
app.use('/api/ai', aiRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/notifications', notificationRouter);

// 3. 기본 접속 테스트용
app.get('/', (req, res) => {
    res.send('Codeponics Backend Server is Running! 🥬✨');
});

// 4. 서버 시작
server.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`🐘 관리자 히야님! 상추 키울 준비 완료됐어요!`);
    console.log(`=============================================`);
});