const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const KakaoStrategy = require('passport-kakao').Strategy;
const NaverStrategy = require('passport-naver-v2').Strategy;
const db = require('./db'); // 아까 만든 DB 연결 파일

// 구글 소셜로그인
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    const { id, emails, displayName, photos } = profile;
    const email = emails[0].value;
    const profileImg = photos[0].value;

    try {
        // 1. 이미 가입된 사용자인지 확인
        let user = await db.query('SELECT * FROM users WHERE social_id = $1', [id]);
        
        if (user.rows.length === 0) {
            // 2. 신규 사용자라면 DB에 저장! 🥬
            user = await db.query(
                'INSERT INTO users (social_id, provider, email, nickname, profile_img) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, 'google', email, displayName, profileImg]
            );
        }
        return done(null, user.rows[0]);
    } catch (err) {
        return done(err);
    }
  }
));

// 카카오 소셜로그인
passport.use(new KakaoStrategy({
    clientID: process.env.KAKAO_CLIENT_ID,    
    clientSecret: process.env.KAKAO_CLIENT_SECRET, 
    callbackURL: "/api/auth/kakao/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    const id = profile.id.toString(); // ID는 문자열로 통일하는 게 좋음!
    const nickname = profile.username || profile.displayName;
    const email = profile._json.kakao_account.email || null;
    const profileImg = profile._json.properties.profile_image || null;

    try {
        // 소셜 ID와 제공자(kakao)가 일치하는지 확인
        let user = await db.query('SELECT * FROM users WHERE social_id = $1 AND provider = $2', [id, 'kakao']);
        
        if (user.rows.length === 0) {
            // 신규 사용자 저장! 🐟
            user = await db.query(
                'INSERT INTO users (social_id, provider, email, nickname, profile_img) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, 'kakao', email, nickname, profileImg]
            );
        }
        return done(null, user.rows[0]);
    } catch (err) { return done(err); }
  }
));

// 네이버 소셜로그인 추가! 🍀
passport.use(new NaverStrategy({
    clientID: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
    callbackURL: "/api/auth/naver/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    // profile 객체 구조가 구글/카카오랑 조금 달라요.
    // passport-naver-v2는 데이터를 깔끔하게 정리해서 줍니다.
    const { id, email, nickname, profileImage } = profile;
    // console.log(nickname);
    
    try {
        // 1. 이미 가입된 사용자인지 확인 (provider 체크 필수!)
        let user = await db.query(
            'SELECT * FROM users WHERE social_id = $1 AND provider = $2', 
            [id, 'naver']
        );
        
        if (user.rows.length === 0) {
            // 2. 신규 사용자라면 DB에 저장! 🌿
            user = await db.query(
                'INSERT INTO users (social_id, provider, email, nickname, profile_img) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, 'naver', email, nickname, profileImage]
            );            
        }
        return done(null, user.rows[0]);
    } catch (err) {
        return done(err);
    }
  }
));

// 세션에 사용자 ID 저장
passport.serializeUser((user, done) => done(null, user.user_id));
// 세션에서 사용자 정보 복구
passport.deserializeUser(async (id, done) => {
    try {
        const user = await db.query('SELECT * FROM users WHERE user_id = $1', [id]);
        if (user.rows[0]) {
            return done(null, user.rows[0]); // 유저가 있으면 정보 복구!
        }
        return done(null, false); // 유저가 없으면 실패 처리
    } catch (err) {
        console.error("데deserialize 중 에러:", err);
        return done(err);
    }
});

module.exports = passport;