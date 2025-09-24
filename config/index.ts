export default {
    PORT: process.env.PORT as string,
    MONGO_URI: process.env.MONGO_URI as string,
    API_HOST: process.env.API_HOST as string,
    CORS_ORIGIN: ['http://localhost:3000', 'https://admin.socket.io/#/', 'https://bingo-frontend-la1y.onrender.com],
}
