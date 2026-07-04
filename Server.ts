export const serverConfig = {
  port: process.env.PORT || 80,
  nodeEnv: process.env.nodeEnv || 'development',
  jwtSecret: process.env.secret || 'a'
};